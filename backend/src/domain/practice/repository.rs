use crate::domain::practice::model::{
    PracticeModel, PracticeProgressModel, PracticeSummary, PracticeTaskRow,
};
use crate::domain::task::model::Task;
use crate::dto::practice::{CreatePracticeRequestDTO, UpdatePracticeRequestDTO};
use crate::errors::Result;
use crate::gen_openapi::DummyRepository;
use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;
use serde_json::Value;
use uuid::Uuid;

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait PracticeRepository {
    async fn create_practice(&self, practice: CreatePracticeRequestDTO) -> Result<PracticeModel>;
    async fn get_practice(&self, id: i32) -> Result<PracticeModel>;
    async fn list_in_topic(&self, topic_id: i32, user_id: Uuid) -> Result<Vec<PracticeSummary>>;
    async fn update_practice(
        &self,
        id: i32,
        practice: UpdatePracticeRequestDTO,
    ) -> Result<PracticeModel>;
    /// Deletes the practice and all of its owned tasks.
    async fn delete_practice(&self, id: i32) -> Result<()>;

    /// Links an already-created task to a practice at the given order.
    async fn link_task(&self, practice_id: i32, task_id: i32, order_index: i32) -> Result<()>;
    /// Next free order index for a task within the practice.
    async fn next_task_order(&self, practice_id: i32) -> Result<i32>;
    /// Tasks in a practice with the caller's progress (for learners).
    async fn list_tasks(&self, practice_id: i32, user_id: Uuid) -> Result<Vec<PracticeTaskRow>>;
    /// Full tasks in a practice (for teachers/editing).
    async fn list_tasks_admin(&self, practice_id: i32) -> Result<Vec<Task>>;
    /// Removes a task from a practice and deletes the (owned) task.
    async fn remove_task(&self, practice_id: i32, task_id: i32) -> Result<()>;
    /// Whether the given task belongs to the given practice.
    async fn task_in_practice(&self, practice_id: i32, task_id: i32) -> Result<bool>;

    /// Ids of every topic offering this task as practice.
    async fn get_practice_topic_ids(&self, task_id: i32) -> Result<Vec<i32>>;
    /// Records one submission, incrementing the attempt count and latching
    /// `solved`. Returns the updated progress.
    async fn record_attempt(
        &self,
        user_id: Uuid,
        task_id: i32,
        solved: bool,
        last_answer: Value,
    ) -> Result<PracticeProgressModel>;
}
