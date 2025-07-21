use uuid::Uuid;

use crate::{
    domain::courses::{model::CourseModel, repository::CourseRepository},
    dto::course::UpsertCourseRequestDTO,
    errors::Result,
    repo,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct CourseService {
    repo: repo!(CourseRepository),
}

impl CourseService {
    pub fn new(repo: repo!(CourseRepository)) -> Self {
        Self { repo }
    }

    pub async fn get_all_courses(&self) -> Result<Vec<CourseModel>> {
        self.repo.get_all_courses().await
    }

    pub async fn get_course_by_id(&self, course_id: i32) -> Result<CourseModel> {
        self.repo.get_course_by_id(course_id).await
    }

    pub async fn create_course(
        &self,
        user_id: Uuid,
        course: UpsertCourseRequestDTO,
    ) -> Result<CourseModel> {
        self.repo.create_course(user_id, course).await
    }

    pub async fn edit_course(
        &self,
        course_id: i32,
        user_id: Uuid,
        course: UpsertCourseRequestDTO,
    ) -> Result<CourseModel> {
        self.repo.edit_course(course_id, user_id, course).await
    }

    pub async fn delete_course(&self, course_id: i32, user_id: Uuid) -> Result<()> {
        self.repo.delete_course(course_id, user_id).await
    }

    pub fn get_course_feed() -> Result<()> {
        todo!()
    }
}
