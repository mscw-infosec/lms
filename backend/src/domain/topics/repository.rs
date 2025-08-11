use crate::{
    domain::topics::model::TopicModel, dto::topics::UpsertTopicRequestDTO, errors::Result,
    gen_openapi::DummyRepository,
};
use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;

#[impl_unimplemented]
#[async_trait]
pub trait TopicRepository {
    async fn get_topic_by_id(&self, id: i32) -> Result<TopicModel>;
    async fn get_all_topics_in_course(&self, course_id: i32) -> Result<Vec<TopicModel>>;
    async fn add_topic_to_course(&self, topic: UpsertTopicRequestDTO) -> Result<()>;
    async fn delete_topic(&self, id: i32) -> Result<()>;
    async fn update_topic(&self, id: i32, topic: UpsertTopicRequestDTO) -> Result<()>;
}
