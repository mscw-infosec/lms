use crate::domain::account::model::UserRole;
use crate::domain::lectures::model::{LectureModel, TopicLectureModel};
use crate::domain::lectures::repository::LectureRepository;
use crate::domain::topics::service::TopicService;
use crate::dto::lectures::{CreateLectureRequestDTO, UpdateLectureRequestDTO};
use crate::errors::Result;
use crate::repo;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct LectureService {
    repo: repo!(LectureRepository),
    topic_service: TopicService,
}

impl LectureService {
    pub fn new(repo: repo!(LectureRepository), topic_service: TopicService) -> Self {
        Self {
            repo,
            topic_service,
        }
    }

    /// Ensures the caller may act on the topic a lecture lives in (course access
    /// filter for students, unrestricted for teachers/admins).
    async fn ensure_topic_access(&self, user: Uuid, role: UserRole, topic_id: i32) -> Result<()> {
        let _ = self
            .topic_service
            .get_topic_by_id(user, role, topic_id)
            .await?;
        Ok(())
    }

    pub async fn create_lecture(
        &self,
        user: Uuid,
        role: UserRole,
        lecture: CreateLectureRequestDTO,
    ) -> Result<LectureModel> {
        self.ensure_topic_access(user, role, lecture.topic_id)
            .await?;
        self.repo.create(lecture).await
    }

    pub async fn get_lecture(
        &self,
        user: Uuid,
        role: UserRole,
        id: i32,
    ) -> Result<(LectureModel, bool)> {
        let topic_id = self.repo.get_topic_id(id).await?;
        self.ensure_topic_access(user, role, topic_id).await?;
        let lecture = self.repo.get(id).await?;
        let completed = self.repo.is_completed(user, id).await?;
        Ok((lecture, completed))
    }

    pub async fn list_in_topic(
        &self,
        user: Uuid,
        role: UserRole,
        topic_id: i32,
    ) -> Result<Vec<TopicLectureModel>> {
        self.ensure_topic_access(user, role, topic_id).await?;
        self.repo.list_in_topic(topic_id, user).await
    }

    pub async fn update_lecture(
        &self,
        user: Uuid,
        role: UserRole,
        id: i32,
        lecture: UpdateLectureRequestDTO,
    ) -> Result<LectureModel> {
        let topic_id = self.repo.get_topic_id(id).await?;
        self.ensure_topic_access(user, role, topic_id).await?;
        self.repo.update(id, lecture).await
    }

    pub async fn delete_lecture(&self, user: Uuid, role: UserRole, id: i32) -> Result<()> {
        let topic_id = self.repo.get_topic_id(id).await?;
        self.ensure_topic_access(user, role, topic_id).await?;
        self.repo.delete(id).await
    }

    pub async fn mark_completed(&self, user: Uuid, role: UserRole, id: i32) -> Result<()> {
        let topic_id = self.repo.get_topic_id(id).await?;
        self.ensure_topic_access(user, role, topic_id).await?;
        self.repo.mark_completed(user, id).await
    }
}
