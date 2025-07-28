use uuid::Uuid;

use crate::{
    domain::topics::{model::TopicModel, repository::TopicRepository},
    dto::topics::UpsertTopicRequestDTO,
    errors::Result,
    repo,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct TopicService {
    repo: repo!(TopicRepository),
}

impl TopicService {
    pub fn new(repo: repo!(TopicRepository)) -> Self {
        Self { repo }
    }

    pub async fn get_all_topics_in_course(&self, course_id: i32) -> Result<Vec<TopicModel>> {
        self.repo.get_all_topics_in_course(course_id).await
    }

    pub async fn get_topic_by_id(&self, id: i32) -> Result<TopicModel> {
        self.repo.get_topic_by_id(id).await
    }

    pub async fn delete_topic(&self, id: i32) -> Result<()> {
        self.repo.delete_topic(id).await
    }

    pub async fn update_topic(&self, id: i32, topic: UpsertTopicRequestDTO) -> Result<()> {
        self.repo.update_topic(id, topic).await
    }

    pub async fn add_topic_to_course(&self, topic: UpsertTopicRequestDTO) -> Result<()> {
        self.repo.add_topic_to_course(topic).await
    }
}
