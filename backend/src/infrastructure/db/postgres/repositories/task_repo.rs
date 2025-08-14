use crate::domain::exam::model::Exam;
use crate::domain::exam::model::ExamType;
use crate::domain::task::model::{Task, TaskType};
use crate::domain::task::repository::TaskRepository;
use crate::dto::task::UpsertTaskRequestDTO;
use crate::errors::{LMSError, Result};
use crate::infrastructure::db::postgres::RepositoryPostgres;
use async_trait::async_trait;
use serde_json::to_value;

#[async_trait]
impl TaskRepository for RepositoryPostgres {
    async fn create(&self, config: UpsertTaskRequestDTO) -> Result<Task> {
        let mut conn = self.pool.acquire().await?;

        let task = sqlx::query_as!(
            Task,
            r#"
                INSERT INTO tasks (title, description, task_type, points, configuration)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, title, description, task_type AS "task_type: TaskType", points, configuration
            "#,
            config.title,
            config.description,
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
                SELECT id, title, description, task_type AS "task_type: TaskType", points, configuration
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

    async fn get_exams(&self, id: i32) -> Result<Vec<Exam>> {
        let exams: Vec<Exam> = sqlx::query_as!(
            Exam,
            r#"
                SELECT e.id, e.topic_id, e.tries_count, e.duration, e.type AS "type: ExamType",
                       e.description, e.name
                FROM exam_tasks et
                LEFT JOIN exams e ON e.id = et.exam_id
                WHERE et.task_id = $1
            "#,
            id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(exams)
    }

    async fn get_topic_tasks(&self) -> Result<Vec<Task>> {
        todo!()
    }

    async fn get_tasks(&self, limit: i32, offset: i32) -> Result<Vec<Task>> {
        let tasks = sqlx::query_as!(
            Task,
            r#"
                SELECT id,
                       title,
                       description,
                       task_type as "task_type: TaskType",
                       points,
                       configuration
                FROM tasks
                OFFSET $1
                LIMIT $2
            "#,
            i64::from(offset),
            i64::from(limit)
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(tasks)
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
                    task_type = $3,
                    points = $4,
                    configuration = $5
                WHERE id = $6
                RETURNING id, title, description, task_type AS "task_type: TaskType",
                          points, configuration
            "#,
            task_data.title,
            task_data.description,
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
}
