use crate::domain::task::model::{Task, TaskAnswer, TaskType};
use crate::domain::task::repository::TaskRepository;
use crate::dto::task::{TaskAttempt, UpsertTaskRequestDTO};
use crate::errors::{LMSError, Result};
use crate::infrastructure::db::postgres::RepositoryPostgres;
use async_trait::async_trait;
use serde_json::to_value;
use uuid::Uuid;

#[async_trait]
impl TaskRepository for RepositoryPostgres {
    async fn create(&self, config: UpsertTaskRequestDTO) -> Result<Task> {
        let mut conn = self.pool.acquire().await?;

        let task = sqlx::query_as!(
            Task,
            r#"
            INSERT INTO tasks (title, description, tries_count, task_type, points, configuration)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, title, description, tries_count, task_type AS "task_type: TaskType", points, configuration
            "#,
            config.title,
            config.description,
            config.tries_count,
            config.task_type as TaskType,
            config.points,
            to_value(config.configuration)
                .expect("Shit happened while converting configuration to serde Value")
        )
            .fetch_one(conn.as_mut())
            .await?;

        Ok(task)
    }

    async fn get_task(&self, id: i32) -> Result<Task> {
        let mut conn = self.pool.acquire().await?;

        let task = sqlx::query_as!(
            Task,
            r#"
            SELECT id, title, description, tries_count, task_type AS "task_type: TaskType", points, configuration
            FROM tasks
            WHERE id = $1
            "#,
            id
        )
            .fetch_one(conn.as_mut())
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => LMSError::NotFound("Task not found".to_string()),
                _ => LMSError::DatabaseError(e),
            })?;

        Ok(task)
    }

    async fn get_topic_tasks(&self) -> Result<Vec<Task>> {
        todo!()
    }

    async fn get_tasks(&self, limit: i32, offset: i32) -> Result<Vec<Task>> {
        todo!()
    }

    async fn delete_task(&self, id: i32) -> Result<()> {
        let mut conn = self.pool.acquire().await?;

        let _ = sqlx::query!(
            r#"
            DELETE FROM tasks
            WHERE id = $1
            RETURNING id
            "#,
            id
        )
            .fetch_one(conn.as_mut())
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => LMSError::NotFound("Task not found".to_string()),
                _ => LMSError::DatabaseError(e),
            })?;

        Ok(())
    }

    async fn update_task(&self, task_id: i32, task_data: UpsertTaskRequestDTO) -> Result<Task> {
        let mut conn = self.pool.acquire().await?;

        let task = sqlx::query_as!(
            Task,
            r#"
            UPDATE tasks
            SET title = $1,
                description = $2,
                tries_count = $3,
                task_type = $4,
                points = $5,
                configuration = $6
            WHERE id = $7
            RETURNING id, title, description, tries_count,
                      task_type AS "task_type: TaskType", points, configuration
            "#,
            task_data.title,
            task_data.description,
            task_data.tries_count,
            task_data.task_type as TaskType,
            task_data.points,
            to_value(task_data.configuration)
                .expect("Shit happened while converting configuration to serde Value"),
            task_id
        )
            .fetch_one(conn.as_mut())
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => LMSError::NotFound("Task not found".to_string()),
                _ => LMSError::DatabaseError(e),
            })?;

        Ok(task)
    }

    async fn get_user_attempts(&self, task_id: i32, user_id: Uuid) -> Result<Vec<TaskAttempt>> {
        let mut conn = self.pool.acquire().await?;

        let attempts = sqlx::query_as!(TaskAttempt, r#"
        SELECT id, user_id, task_id, answer
        FROM attempts
        WHERE user_id = $1 AND task_id = $2
        "#, user_id, task_id)
            .fetch_all(conn.as_mut())
            .await
            .map_err(LMSError::DatabaseError)?;

        Ok(attempts)
    }

    async fn answer_task(&self, task_id: i32, user_id: Uuid, answer: TaskAnswer) -> Result<()> {
        let mut conn = self.pool.acquire().await?;
        
        let _ = sqlx::query!(r#"
        INSERT INTO attempts (user_id, task_id, answer) VALUES ($1, $2, $3)
        "#, user_id, task_id, to_value(answer).expect("Shit happened while converting task answer to serde Value"))
            .execute(conn.as_mut())
            .await
            .map_err(LMSError::DatabaseError)?;
        
        Ok(())
    }
}
