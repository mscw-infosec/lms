use crate::{
    domain::courses::model::CourseModel, dto::course::UpsertCourseRequestDTO, errors::Result,
    gen_openapi::DummyRepository,
};
use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;
use uuid::Uuid;

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait CourseRepository {
    async fn create_course(
        &self,
        user_id: Uuid,
        course: UpsertCourseRequestDTO,
    ) -> Result<CourseModel>;

    async fn edit_course(
        &self,
        course_id: i32,
        user_id: Uuid,
        course: UpsertCourseRequestDTO,
    ) -> Result<CourseModel>;

    async fn delete_course(&self, course_id: i32, user_id: Uuid) -> Result<()>;
    async fn get_course_feed(&self, user_id: Uuid) -> Result<Vec<CourseModel>>;
    async fn get_all_courses(&self) -> Result<Vec<CourseModel>>;
    async fn get_course_by_id(&self, course_id: i32) -> Result<CourseModel>;
}
