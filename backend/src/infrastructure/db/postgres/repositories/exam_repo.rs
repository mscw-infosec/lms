use crate::domain::account::model::UserModel;
use crate::domain::account::model::UserRole;
use crate::domain::exam::model::{Exam, ExamType};
use crate::domain::exam::repository::ExamRepository;
use crate::domain::task::model::TaskType;
use crate::domain::task::model::{Task, TaskAnswer};
use crate::dto::exam::ScoringData;
use crate::dto::exam::{ExamAnswer, ExamAttempt, UpsertExamRequestDTO};
use crate::errors::{LMSError, Result};
use crate::infrastructure::db::postgres::RepositoryPostgres;
use async_trait::async_trait;
use chrono::{Duration, Utc};
use serde_json::to_value;
use sqlx::types::Json;
use std::collections::HashMap;
use uuid::Uuid;

#[async_trait]
impl ExamRepository for RepositoryPostgres {
    async fn create(&self, exam_data: UpsertExamRequestDTO) -> Result<Exam> {
        let mut tx = self.pool.begin().await?;

        let exam = sqlx::query_as!(
            Exam,
            r#"
                INSERT INTO exams
                (topic_id, tries_count, duration, type, description, name)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, topic_id, tries_count, duration, type AS "type: ExamType", name, description
            "#,
            exam_data.topic_id,
            exam_data.tries_count,
            exam_data.duration,
            exam_data.r#type as ExamType,
            exam_data.description,
            exam_data.name,
        )
        .fetch_one(tx.as_mut())
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(ref e) if e.is_foreign_key_violation() => {
                LMSError::Conflict("Topic with such id doesn't exist".to_string())
            }
            _ => LMSError::DatabaseError(err),
        })?;

        let new_exam_index = sqlx::query_scalar!(
            r#"
                SELECT CASE
                     WHEN MAX(order_index) IS NULL THEN 0
                     ELSE MAX(order_index) + 1
                   END AS next_order_index
                FROM exam_ordering
                WHERE topic_id = $1;
            "#,
            exam.topic_id
        )
        .fetch_one(tx.as_mut())
        .await?
        .expect("SQL mess happened with max_order_index!");

        let _ = sqlx::query!(
            r#"
                INSERT INTO exam_ordering (exam_id, topic_id, order_index)
                VALUES ($1, $2, $3);
            "#,
            exam.id,
            exam.topic_id,
            new_exam_index
        )
        .execute(tx.as_mut())
        .await?;

        tx.commit().await?;

        Ok(exam)
    }

    async fn get(&self, id: Uuid) -> Result<Exam> {
        let exam = sqlx::query_as!(
            Exam,
            r#"
                SELECT id, topic_id, name, description, tries_count, duration, type AS "type: ExamType"
                FROM exams
                WHERE id = $1
            "#,
            id,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|err| match err {
            sqlx::Error::RowNotFound => {
                LMSError::NotFound("Exam with such id doesn't exist".to_string())
            }
            _ => LMSError::DatabaseError(err),
        })?;

        Ok(exam)
    }

    async fn update(&self, id: Uuid, exam_data: UpsertExamRequestDTO) -> Result<Exam> {
        let exam = sqlx::query_as!(
            Exam,
            r#"
                UPDATE exams SET
                    topic_id = $1,
                    tries_count = $2,
                    duration = $3,
                    type = $4,
                    name = $5,
                    description = $6
                WHERE id = $7
                RETURNING id, topic_id, tries_count, name, description, duration, type AS "type: ExamType"
            "#,
            exam_data.topic_id,
            exam_data.tries_count,
            exam_data.duration,
            exam_data.r#type as ExamType,
            exam_data.name,
            exam_data.description,
            id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|err| match err {
            sqlx::Error::RowNotFound => {
                LMSError::NotFound("Exam with such id doesn't exist".to_string())
            }
            _ => LMSError::DatabaseError(err),
        })?;

        Ok(exam)
    }

    async fn delete(&self, id: Uuid) -> Result<()> {
        let _ = sqlx::query!(
            r#"
                DELETE FROM exams
                WHERE id = $1
                RETURNING id
            "#,
            id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => {
                LMSError::NotFound("Exam with such id doesn't exist".to_string())
            }
            _ => LMSError::DatabaseError(e),
        })?;

        Ok(())
    }

    async fn get_tasks(&self, id: Uuid) -> Result<Vec<Task>> {
        let tasks: Vec<Task> = sqlx::query_as!(
            Task,
            r#"
                SELECT
                    t.id, t.title, t.description, t.task_type AS "task_type: TaskType", t.points, t.configuration
                FROM exam_tasks et
                LEFT JOIN tasks t ON et.task_id = t.id
                WHERE et.exam_id = $1
            "#,
            id
        )
            .fetch_all(&self.pool)
            .await?;
        Ok(tasks)
    }

    #[allow(clippy::cast_possible_wrap)]
    #[allow(clippy::cast_possible_truncation)]
    async fn update_tasks(&self, id: Uuid, tasks: Vec<i32>) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        let found_tasks = sqlx::query_as!(
            Task,
            r#"
                SELECT id, title, description, task_type AS "task_type: TaskType", points, configuration
                FROM tasks
                WHERE id = ANY($1)
            "#,
            &tasks
        )
            .fetch_all(tx.as_mut())
            .await?;

        if tasks.len() != found_tasks.len() {
            return Err(LMSError::Conflict(
                "You should specify valid task ids".to_string(),
            ));
        }

        let _ = sqlx::query!(
            r#"
                DELETE FROM exam_tasks
                WHERE exam_id = $1
            "#,
            id
        )
        .execute(tx.as_mut())
        .await?;

        let _ = sqlx::query!(
            r#"
                INSERT INTO exam_tasks (exam_id, task_id, order_index)
                SELECT $1, x.task_id, x.order_index
                FROM UNNEST($2::INT[], $3::INT[]) AS x(task_id, order_index)
            "#,
            id,
            &tasks,
            &(0..tasks.len()).map(|x| x as i32).collect::<Vec<i32>>()
        )
        .execute(tx.as_mut())
        .await?;

        tx.commit().await?;

        Ok(())
    }

    async fn get_user_attempts(&self, id: Uuid, user_id: Uuid) -> Result<Vec<ExamAttempt>> {
        let attempts: Vec<ExamAttempt> = sqlx::query_as!(
            ExamAttempt,
            r#"
                SELECT id, exam_id, user_id, started_at, ends_at,
                answer_data as "answer_data: Json<ExamAnswer>", scoring_data as "scoring_data: Json<ScoringData>"
                FROM attempts
                WHERE exam_id = $1 AND user_id = $2
                ORDER BY started_at ASC
            "#,
            id,
            user_id
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(attempts)
    }

    async fn get_user_last_attempt(&self, id: Uuid, user_id: Uuid) -> Result<ExamAttempt> {
        let attempt = sqlx::query_as!(
            ExamAttempt,
            r#"
                SELECT id, exam_id, user_id, started_at, ends_at,
                answer_data as "answer_data: Json<ExamAnswer>", scoring_data as "scoring_data: Json<ScoringData>"
                FROM attempts
                WHERE exam_id = $1 AND user_id = $2
                ORDER BY started_at DESC
                LIMIT 1
            "#,
            id,
            user_id
        )
            .fetch_one(&self.pool)
            .await
            .map_err(|err| match err {
                sqlx::Error::RowNotFound => LMSError::NotFound("Such user has no attempts in this exam".to_string()),
                _ => LMSError::DatabaseError(err),
            })?;

        Ok(attempt)
    }

    async fn stop_attempt(&self, attempt_id: Uuid) -> Result<()> {
        let _ = sqlx::query!(
            r#"
                UPDATE attempts
                SET ends_at = NOW()
                WHERE id = $1
            "#,
            attempt_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    #[allow(clippy::cast_sign_loss)]
    async fn start_exam(&self, id: Uuid, user_id: Uuid) -> Result<ExamAttempt> {
        let mut tx = self.pool.begin().await?;

        let exam = self.get(id).await?;

        let attempts: Vec<ExamAttempt> = sqlx::query_as!(
            ExamAttempt,
            r#"
                SELECT id, exam_id, user_id, started_at, ends_at,
                answer_data as "answer_data: Json<ExamAnswer>", scoring_data as "scoring_data: Json<ScoringData>"
                FROM attempts
                WHERE exam_id = $1 AND user_id = $2
            "#,
            id,
            user_id
        )
            .fetch_all(tx.as_mut())
            .await?;

        if attempts.iter().any(|att| att.ends_at > Utc::now())
            || (attempts.len() >= exam.tries_count as usize && exam.tries_count != 0)
        {
            return Err(LMSError::Conflict(
                "You can't start exam: you either have an active attempt or ran out of attempts"
                    .to_string(),
            ));
        }

        let empty_answer_data = ExamAnswer::default();
        let empty_scoring_data = ScoringData::default();
        let attempt: ExamAttempt = sqlx::query_as!(
            ExamAttempt,
            r#"
                INSERT INTO attempts (exam_id, user_id, answer_data, scoring_data, started_at, ends_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, exam_id, user_id, started_at, ends_at,
                answer_data as "answer_data: Json<ExamAnswer>", scoring_data as "scoring_data: Json<ScoringData>"
            "#,
            id,
            user_id,
            to_value(empty_answer_data).expect("Something bad happened with ExamAnswer data"),
            to_value(empty_scoring_data).expect("Something bad happened with ScoringData"),
            Utc::now(),
            Utc::now() + Duration::seconds(i64::from(exam.duration))
        )
            .fetch_one(tx.as_mut())
            .await?;

        tx.commit().await?;

        Ok(attempt)
    }

    async fn modify_attempt(
        &self,
        exam_id: Uuid,
        user_id: Uuid,
        task_id: usize,
        answer: TaskAnswer,
    ) -> Result<ExamAttempt> {
        let mut attempts = self.get_user_attempts(exam_id, user_id).await?;
        if let Some(active_attempt) = attempts.iter_mut().find(|a| a.ends_at > Utc::now()) {
            let mut answer_data = active_attempt.answer_data.clone();
            answer_data.answers.insert(task_id, answer);
            active_attempt.answer_data = answer_data;
            let _ = sqlx::query!(
                r#"
                    UPDATE attempts
                    SET answer_data = $1
                    WHERE id = $2
                "#,
                to_value(&active_attempt.answer_data)
                    .expect("Something bad happened with AnswerData"),
                active_attempt.id
            )
            .execute(&self.pool)
            .await?;
            return Ok(active_attempt.clone());
        }
        Err(LMSError::NotFound("No active attempt found".to_string()))
    }

    async fn update_attempt_score(
        &self,
        attempt_id: Uuid,
        attempt_score: &ScoringData,
    ) -> Result<()> {
        let _ = sqlx::query!(
            r#"
                UPDATE attempts
                SET scoring_data = $1
                WHERE id = $2
            "#,
            to_value(&attempt_score).expect("Something bad happened with ScoringData"),
            attempt_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_user_by_id(&self, user_id: Uuid) -> Result<UserModel> {
        let mut tx = self.pool.begin().await?;

        let attributes = sqlx::query!(
            r#"
                SELECT key, value
                FROM attributes
                WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_all(tx.as_mut())
        .await
        .map(|x| {
            x.iter()
                .map(|row| (row.key.clone(), row.value.clone()))
                .collect::<HashMap<String, String>>()
        })?;

        let user = sqlx::query!(
            r#"
                SELECT u.id, u.username, u.email, u.created_at,
                       u.role as "role: UserRole", ac.password_hash as password
                FROM users u
                LEFT JOIN auth_credentials ac ON ac.user_id = u.id
                WHERE u.id = $1
            "#,
            user_id
        )
        .fetch_optional(tx.as_mut())
        .await?
        .map(|x| UserModel {
            id: x.id,
            username: x.username,
            email: x.email,
            role: x.role,
            password: x.password,
            attributes,
            created_at: x.created_at,
        });

        Ok(user.ok_or(LMSError::NotFound("No user found".to_string()))?)
    }
}
