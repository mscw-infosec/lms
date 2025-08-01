use crate::domain::exam::model::Exam;
use crate::domain::task::model::Task;
use crate::dto::exam::{ExamAttempt, UpsertExamRequestDTO};
use crate::errors::Result;
use async_trait::async_trait;
use uuid::Uuid;

#[async_trait]
pub trait ExamRepository {
    async fn create(&self, exam_data: UpsertExamRequestDTO) -> Result<Exam>;
    async fn get(&self, id: Uuid) -> Result<Exam>;
    async fn update(&self, id: Uuid, exam_data: UpsertExamRequestDTO) -> Result<Exam>;
    async fn delete(&self, id: Uuid) -> Result<()>;
    async fn get_tasks(&self, id: Uuid) -> Result<Vec<Task>>;
    async fn update_tasks(&self, id: Uuid, tasks: Vec<i32>) -> Result<()>;
    async fn get_user_attempts(&self, id: Uuid, user_id: Uuid) -> Result<Vec<ExamAttempt>>;
}
