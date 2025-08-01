use crate::domain::exam::model::{Exam, ExamType};
use crate::domain::exam::repository::ExamRepository;
use crate::domain::task::model::Task;
use crate::domain::task::model::TaskType;
use crate::dto::exam::{ExamAttempt, UpsertExamRequestDTO};
use crate::errors::{LMSError, Result};
use crate::infrastructure::db::postgres::RepositoryPostgres;
use async_trait::async_trait;
use uuid::Uuid;

#[async_trait]
impl ExamRepository for RepositoryPostgres {
    async fn create(&self, exam_data: UpsertExamRequestDTO) -> Result<Exam> {
        let mut tx = self.pool.begin().await?;

        let exam = sqlx::query_as!(
            Exam,
            r#"
        INSERT INTO exams
        (topic_id, tries_count, duration, exam_type)
        VALUES ($1, $2, $3, $4)
        RETURNING id, topic_id, tries_count, duration, exam_type AS "exam_type: ExamType"
        "#,
            exam_data.topic_id,
            exam_data.tries_count,
            exam_data.duration,
            exam_data.exam_type as ExamType
        )
        .fetch_one(tx.as_mut())
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(ref e) => {
                if e.is_foreign_key_violation() {
                    return LMSError::Conflict("Topic with such id doesn't exist".to_string());
                }
                LMSError::DatabaseError(err)
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
        .await
        .map_err(LMSError::DatabaseError)?
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
        .await
        .map_err(LMSError::DatabaseError)?;

        tx.commit().await?;

        Ok(exam)
    }

    async fn get(&self, id: Uuid) -> Result<Exam> {
        let exam = sqlx::query_as!(
            Exam,
            r#"
        SELECT id, topic_id, tries_count, duration, exam_type AS "exam_type: ExamType"
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
            exam_type = $4
        WHERE id = $5
        RETURNING id, topic_id, tries_count, duration, exam_type AS "exam_type: ExamType"
        "#,
            exam_data.topic_id,
            exam_data.tries_count,
            exam_data.duration,
            exam_data.exam_type as ExamType,
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
        let mut tx = self.pool.begin().await?;

        let task_ids: Vec<i32> = sqlx::query_scalar!(
            r#"
        SELECT task_id FROM exam_tasks WHERE exam_id = $1
        "#,
            id
        )
        .fetch_all(tx.as_mut())
        .await
        .map_err(LMSError::DatabaseError)?;

        let tasks: Vec<Task> = sqlx::query_as!(
            Task,
            r#"
        SELECT id, title, description, task_type AS "task_type: TaskType", points, configuration
        FROM tasks
        WHERE id = ANY($1)
        "#,
            &task_ids
        )
        .fetch_all(tx.as_mut())
        .await
        .map_err(LMSError::DatabaseError)?;

        tx.commit().await?;
        Ok(tasks)
    }

    #[allow(clippy::cast_possible_wrap)]
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
        .await
        .map_err(LMSError::DatabaseError)?;

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
        .await
        .map_err(LMSError::DatabaseError)?;

        for (index, task) in tasks.iter().enumerate() {
            let _ = sqlx::query!(
                r#"
            INSERT INTO exam_tasks (exam_id, task_id, order_index)
            VALUES ($1, $2, $3)
            "#,
                id,
                task,
                index as i64
            )
            .execute(tx.as_mut())
            .await
            .map_err(LMSError::DatabaseError)?;
        }

        tx.commit().await?;

        Ok(())
    }

    async fn get_user_attempts(&self, id: Uuid, user_id: Uuid) -> Result<Vec<ExamAttempt>> {
        let attempts: Vec<ExamAttempt> = sqlx::query_as!(
            ExamAttempt,
            r#"
        SELECT id, exam_id, user_id, started_at, active, answer_data
        FROM attempts
        WHERE exam_id = $1 AND user_id = $2
        "#,
            id,
            user_id
        )
        .fetch_all(&self.pool)
        .await
        .map_err(LMSError::DatabaseError)?;

        Ok(attempts)
    }
}
