use crate::domain::lectures::model::{LectureModel, TopicLectureModel};
use crate::dto::lectures::{CreateLectureRequestDTO, UpdateLectureRequestDTO};
use crate::errors::Result;
use crate::gen_openapi::DummyRepository;
use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;
use uuid::Uuid;

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait LectureRepository {
    async fn create(&self, lecture: CreateLectureRequestDTO) -> Result<LectureModel>;
    async fn get(&self, id: i32) -> Result<LectureModel>;
    /// Returns the id of the topic this lecture belongs to (via `lecture_links`).
    async fn get_topic_id(&self, lecture_id: i32) -> Result<i32>;
    async fn list_in_topic(&self, topic_id: i32, user_id: Uuid) -> Result<Vec<TopicLectureModel>>;
    async fn update(&self, id: i32, lecture: UpdateLectureRequestDTO) -> Result<LectureModel>;
    async fn delete(&self, id: i32) -> Result<()>;
    async fn is_completed(&self, user_id: Uuid, lecture_id: i32) -> Result<bool>;
    async fn mark_completed(&self, user_id: Uuid, lecture_id: i32) -> Result<()>;
}
