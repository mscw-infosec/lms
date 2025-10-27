use crate::domain::account::model::UserModel;
use crate::domain::account::model::UserRole;
use crate::domain::exam::model::{
    Exam, ExamEntity, ExamEntityType, ExamExtendedEntity, ExamType, TextEntity,
};
use crate::domain::exam::repository::ExamRepository;
use crate::domain::task::model::TaskType;
use crate::domain::task::model::{Task, TaskAnswer};
use crate::dto::exam::ScoringData;
use crate::dto::exam::{ExamAnswer, ExamAttempt, UpsertExamRequestDTO};
use crate::dto::task::TaskVerdict;
use crate::errors::{LMSError, Result};
use crate::infrastructure::db::postgres::RepositoryPostgres;
use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use serde_json::to_value;
use sqlx::types::Json;
use std::cmp::min;
use std::collections::HashMap;
use tokio::try_join;
use uuid::Uuid;

#[async_trait]
impl ExamRepository for RepositoryPostgres {
    async fn create(&self, exam_data: UpsertExamRequestDTO) -> Result<Exam> {
        let mut tx = self.pool.begin().await?;

        let exam = sqlx::query_as!(
            Exam,
            r#"
                INSERT INTO exams
                (topic_id, tries_count, duration, type, description, name, starts_at, ends_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, topic_id, tries_count, duration, type AS "type: ExamType", name, description, starts_at, ends_at
            "#,
            exam_data.topic_id,
            exam_data.tries_count,
            exam_data.duration,
            exam_data.r#type as ExamType,
            exam_data.description,
            exam_data.name,
            exam_data.starts_at,
            exam_data.ends_at
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
                SELECT id, topic_id, name, description, tries_count, duration, type AS "type: ExamType", starts_at, ends_at
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
                    description = $6,
                    starts_at = $7,
                    ends_at = $8
                WHERE id = $9
                RETURNING id, topic_id, tries_count, name, description, duration, type AS "type: ExamType", starts_at, ends_at
            "#,
            exam_data.topic_id,
            exam_data.tries_count,
            exam_data.duration,
            exam_data.r#type as ExamType,
            exam_data.name,
            exam_data.description,
            exam_data.starts_at,
            exam_data.ends_at,
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

    async fn get_entities(&self, id: Uuid) -> Result<Vec<ExamExtendedEntity>> {
        // TODO: yes, this is shit and a terrible implementation, but right now I need PoC, and I promise to fix it later
        if let Ok((tasks, texts)) = try_join!(sqlx::query_as!(
            Task,
            r#"
                SELECT
                    t.id, t.title, t.description, t.task_type AS "task_type: TaskType", t.points, t.configuration
                FROM exam_entities et
                LEFT JOIN tasks t ON et.task_id = t.id
                WHERE et.exam_id = $1 AND et.entity_type = 'task'
            "#,
            id
        )
            .fetch_all(&self.pool), sqlx::query_as!(
            TextEntity,
            r#"
                SELECT
                    t.id, t.text
                FROM exam_entities et
                LEFT JOIN exam_texts t ON et.text_id = t.id
                WHERE et.exam_id = $1 AND et.entity_type = 'text'
            "#,
            id
        )
        .fetch_all(&self.pool)) {
            let mut orders = sqlx::query!(
            r#"
                SELECT
                    et.order_index, et.entity_type as "entity_type: ExamEntityType", et.task_id, et.text_id
                FROM exam_entities et
                WHERE et.exam_id = $1
                ORDER BY et.order_index ASC
            "#,
            id
        )
                .fetch_all(&self.pool)
                .await?
                .iter().map(|row| {
                match row.entity_type {
                    ExamEntityType::Task => {
                        let task_id = row.task_id.expect("Task id should exist since entity type is task");
                        let task = tasks.iter().find(|t| t.id == i64::from(task_id)).expect("Task should exist since entity type is task");
                        (row.order_index, ExamExtendedEntity::Task {
                            task: task.clone(),
                        })
                    }
                    ExamEntityType::Text => {
                        let text_id = row.text_id.expect("Text id should exist since entity type is text");
                        let text = texts.iter().find(|t| t.id == text_id).expect("Text should exist since entity type is text");
                        (row.order_index, ExamExtendedEntity::Text {
                            text: text.clone(),
                        })
                    }
                }
            }).collect::<Vec<(i32, ExamExtendedEntity)>>();
            orders.sort_by(|x1, x2| x1.0.cmp(&x2.0));
            return Ok(orders.into_iter().map(|x| x.1).collect())
        }
        Err(LMSError::ServerError(
            "database failed to fetch entities".to_string(),
        ))
    }

    #[allow(clippy::cast_possible_wrap)]
    #[allow(clippy::cast_possible_truncation)]
    async fn update_entities(&self, id: Uuid, tasks: Vec<ExamEntity>) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        let _ = sqlx::query!(
            r#"
                DELETE FROM exam_entities
                WHERE exam_id = $1
            "#,
            id
        )
        .execute(tx.as_mut())
        .await?;

        let _ = sqlx::query!(
            r#"
                INSERT INTO exam_entities (exam_id, task_id, text_id, entity_type, order_index)
                SELECT
                    $1,
                    NULLIF(x.task_id, -1),
                    NULLIF(x.text_id, '00000000-0000-0000-0000-000000000000'),
                    CASE WHEN x.task_id <> -1
                        THEN 'task'::EXAM_ENTITY_TYPE
                        ELSE 'text'::EXAM_ENTITY_TYPE
                    END,
                    x.order_index
                FROM UNNEST($2::INT[], $3::UUID[], $4::INT[]) AS x(task_id, text_id, order_index)
            "#,
            id,
            &tasks
                .iter()
                .map(|t| match t {
                    ExamEntity::Task { id } => *id,
                    ExamEntity::Text { .. } => -1,
                })
                .collect::<Vec<i32>>(),
            &tasks
                .iter()
                .map(|t| match t {
                    ExamEntity::Text { id } => *id,
                    ExamEntity::Task { .. } => Uuid::nil(),
                })
                .collect::<Vec<Uuid>>(),
            &(0..tasks.len()).map(|x| x as i32).collect::<Vec<i32>>()
        )
        .execute(tx.as_mut())
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(e) if e.is_foreign_key_violation() => {
                LMSError::Conflict("You should provide existing task & text ids.".to_string())
            }
            _ => LMSError::DatabaseError(err),
        })?;

        tx.commit().await?;

        Ok(())
    }

    async fn get_exam_attempts(
        &self,
        exam_id: Uuid,
        limit: i32,
        offset: i32,
    ) -> Result<Vec<ExamAttempt>> {
        let attempts: Vec<ExamAttempt> = sqlx::query_as!(
            ExamAttempt,
            r#"
                SELECT id, exam_id, user_id, started_at, ends_at,
                answer_data as "answer_data: Json<ExamAnswer>", scoring_data as "scoring_data: Json<ScoringData>"
                FROM attempts
                WHERE exam_id = $1
                ORDER BY started_at ASC
                LIMIT $2 OFFSET $3
            "#,
            exam_id,
            i64::from(limit),
            i64::from(offset)
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(attempts)
    }

    async fn get_exam_unscored_attempts(&self, exam_id: Uuid) -> Result<Vec<ExamAttempt>> {
        let attempts: Vec<ExamAttempt> = sqlx::query_as!(
            ExamAttempt,
            r#"
                SELECT id, exam_id, user_id, started_at, ends_at,
                answer_data as "answer_data: Json<ExamAnswer>", scoring_data as "scoring_data: Json<ScoringData>"
                FROM attempts
                WHERE exam_id = $1
                AND scoring_data = '{"results": {}, "show_results": false}'::jsonb
                AND answer_data != '{"answers": {}}'::jsonb
                AND ends_at < NOW()
                ORDER BY started_at ASC
            "#,
            exam_id
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(attempts)
    }

    async fn get_user_attempts_in_exam(&self, id: Uuid, user_id: Uuid) -> Result<Vec<ExamAttempt>> {
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

    async fn get_user_last_attempt_in_exam(&self, id: Uuid, user_id: Uuid) -> Result<ExamAttempt> {
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
            min(Utc::now() + Duration::seconds(i64::from(exam.duration)), exam.ends_at.unwrap_or(DateTime::<Utc>::MAX_UTC))
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
        let mut attempts = self.get_user_attempts_in_exam(exam_id, user_id).await?;
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

    async fn create_text(&self, text: String) -> Result<TextEntity> {
        let text_entity = sqlx::query_as!(
            TextEntity,
            r#"
                INSERT INTO exam_texts (text)
                VALUES ($1)
                RETURNING id, text
            "#,
            text
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(text_entity)
    }

    async fn update_text(&self, id: Uuid, text: String) -> Result<TextEntity> {
        let text_entity = sqlx::query_as!(
            TextEntity,
            r#"
                UPDATE exam_texts
                SET text = $1
                WHERE id = $2
                RETURNING id, text
            "#,
            text,
            id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|err| match err {
            sqlx::Error::RowNotFound => {
                LMSError::NotFound("Text with such id doesn't exist".to_string())
            }
            _ => LMSError::DatabaseError(err),
        })?;
        Ok(text_entity)
    }

    async fn delete_text(&self, id: Uuid) -> Result<()> {
        let _ = sqlx::query_as!(
            TextEntity,
            r#"
                DELETE FROM exam_texts
                WHERE id = $1
                RETURNING id, text
            "#,
            id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|err| match err {
            sqlx::Error::RowNotFound => {
                LMSError::NotFound("Text with such id doesn't exist".to_string())
            }
            _ => LMSError::DatabaseError(err),
        })?;
        Ok(())
    }

    async fn get_text(&self, id: Uuid) -> Result<TextEntity> {
        let text_entity = sqlx::query_as!(
            TextEntity,
            r#"
                SELECT id, text
                FROM exam_texts
                WHERE id = $1
            "#,
            id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|err| match err {
            sqlx::Error::RowNotFound => {
                LMSError::NotFound("Text with such id doesn't exist".to_string())
            }
            _ => LMSError::DatabaseError(err),
        })?;
        Ok(text_entity)
    }

    async fn update_attempt_verdict(
        &self,
        attempt_id: Uuid,
        task_id: i32,
        verdict: TaskVerdict,
    ) -> Result<()> {
        let _ = sqlx::query!(
            r#"
                UPDATE attempts
                SET scoring_data = jsonb_set(
                    scoring_data,
                    ARRAY['results', $1],
                    to_jsonb($2::jsonb),
                    true
                )
                WHERE id = $3
            "#,
            task_id.to_string(),
            to_value(verdict).expect("Something bad happened with TaskVerdict data"),
            attempt_id,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_attempt_visibility_by_id(
        &self,
        attempt_id: Uuid,
        show_results: bool,
    ) -> Result<()> {
        sqlx::query!(
            r#"
            UPDATE attempts
            SET scoring_data = jsonb_set(
                scoring_data,
                ARRAY['show_results'],
                to_jsonb($1::boolean),
                true
            )
            WHERE id = $2
            "#,
            show_results,
            attempt_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_attempts_visibility_by_exam(
        &self,
        exam_id: Uuid,
        show_results: bool,
    ) -> Result<()> {
        sqlx::query!(
            r#"
            UPDATE attempts
            SET scoring_data = jsonb_set(
                scoring_data,
                ARRAY['show_results'],
                to_jsonb($1::boolean),
                true
            )
            WHERE exam_id = $2
            "#,
            show_results,
            exam_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
