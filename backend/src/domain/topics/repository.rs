use crate::domain::exam::model::Exam;
use crate::{
    domain::topics::model::{TopicContentRow, TopicModel},
    dto::topics::UpsertTopicRequestDTO,
    errors::Result,
    gen_openapi::DummyRepository,
};
use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait TopicRepository {
    async fn get_topic_by_id(&self, id: i32) -> Result<TopicModel>;
    async fn get_all_topics_in_course(&self, course_id: i32) -> Result<Vec<TopicModel>>;
    async fn add_topic_to_course(&self, topic: UpsertTopicRequestDTO) -> Result<()>;
    async fn delete_topic(&self, id: i32) -> Result<()>;
    async fn update_topic(&self, id: i32, topic: UpsertTopicRequestDTO) -> Result<()>;
    async fn get_exams(&self, id: i32) -> Result<Vec<Exam>>;

    /// Unified, ordered content of a topic (lectures, practices, exams, texts).
    async fn get_topic_content(&self, topic_id: i32) -> Result<Vec<TopicContentRow>>;
    /// Reassigns order indices across all content kinds to match the given order.
    async fn reorder_topic_content(&self, topic_id: i32, items: &[(String, String)]) -> Result<()>;
    async fn create_topic_text(&self, topic_id: i32, title: String, content: String)
    -> Result<i32>;
    async fn update_topic_text(
        &self,
        topic_id: i32,
        text_id: i32,
        title: String,
        content: String,
    ) -> Result<()>;
    async fn delete_topic_text(&self, topic_id: i32, text_id: i32) -> Result<()>;
}
