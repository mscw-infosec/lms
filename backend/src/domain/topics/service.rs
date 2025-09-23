use crate::domain::account::model::UserRole;
use crate::domain::courses::service::CourseService;
use crate::domain::exam::model::Exam;
use crate::{
    domain::topics::{model::TopicModel, repository::TopicRepository},
    dto::topics::UpsertTopicRequestDTO,
    errors::Result,
    repo,
};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct TopicService {
    repo: repo!(TopicRepository),
    course_service: CourseService,
}

impl TopicService {
    pub fn new(repo: repo!(TopicRepository), course_service: CourseService) -> Self {
        Self {
            repo,
            course_service,
        }
    }

    pub async fn get_all_topics_in_course(
        &self,
        user: Uuid,
        role: UserRole,
        course_id: i32,
    ) -> Result<Vec<TopicModel>> {
        let _ = self
            .course_service
            .get_course_by_id(user, role, course_id)
            .await?; // need it to check for access
        self.repo.get_all_topics_in_course(course_id).await
    }

    pub async fn get_topic_by_id(
        &self,
        user: Uuid,
        role: UserRole,
        topic_id: i32,
    ) -> Result<TopicModel> {
        let topic = self.repo.get_topic_by_id(topic_id).await?;
        let _ = self
            .course_service
            .get_course_by_id(user, role, topic.course_id)
            .await?; // need it to check for access

        Ok(topic)
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

    pub async fn get_exams(&self, user: Uuid, role: UserRole, topic_id: i32) -> Result<Vec<Exam>> {
        let _ = self.get_topic_by_id(user, role, topic_id).await?; // need it all to check for access
        self.repo.get_exams(topic_id).await
    }
}
