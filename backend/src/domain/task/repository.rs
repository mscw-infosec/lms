use crate::domain::task::model::Task;
use crate::dto::task::UpsertTaskRequestDTO;
use crate::errors::Result;
use async_trait::async_trait;

#[async_trait]
pub trait TaskRepository {
    async fn create(&self, task_data: UpsertTaskRequestDTO) -> Result<Task>;
    async fn get_task(&self, id: i32) -> Result<Task>;
    async fn get_topic_tasks(&self) -> Result<Vec<Task>>;
    async fn get_tasks(&self, limit: i32, offset: i32) -> Result<Vec<Task>>;
    async fn delete_task(&self, id: i32) -> Result<()>;
    async fn update_task(&self, task_id: i32, task_data: UpsertTaskRequestDTO) -> Result<Task>;
}
