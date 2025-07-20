use crate::domain::task::model::{Task, TaskType};
use crate::domain::task::repository::TaskRepository;
use crate::dto::task::CreateTaskRequestDTO;
use crate::errors::Result;
use crate::infrastructure::db::postgres::RepositoryPostgres;
use async_trait::async_trait;
use serde_json::to_value;

#[async_trait]
impl TaskRepository for RepositoryPostgres {
    async fn create(&self, config: CreateTaskRequestDTO) -> Result<Task> {
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

    async fn get_topic_tasks(&self) -> Result<Vec<Task>> {
        todo!()
    }

    async fn get_tasks(&self, limit: i32, offset: i32) -> Result<Vec<Task>> {
        todo!()
    }
}
