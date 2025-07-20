use crate::domain::task::model::Task;
use crate::dto::task::CreateTaskRequestDTO;
use crate::errors::Result;
use async_trait::async_trait;

#[async_trait]
pub trait TaskRepository {
    async fn create(&self, task_data: CreateTaskRequestDTO) -> Result<Task>;
    async fn get_topic_tasks(&self) -> Result<Vec<Task>>;
    async fn get_tasks(&self, limit: i32, offset: i32) -> Result<Vec<Task>>;
}
