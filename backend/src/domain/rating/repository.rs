use crate::domain::rating::model::{
    CourseExamTask, CoursePracticeTask, CourseRef, PracticeSolve, RatingAttempt,
};
use crate::domain::report::model::ReportUser;
use crate::errors::Result;
use crate::gen_openapi::DummyRepository;
use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;
use uuid::Uuid;

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait RatingRepository {
    /// Every exam task reachable within a course, tagged with its exam's
    /// scoring policy.
    async fn course_exam_tasks(&self, course_id: i32) -> Result<Vec<CourseExamTask>>;

    /// Every practice task reachable within a course.
    async fn course_practice_tasks(&self, course_id: i32) -> Result<Vec<CoursePracticeTask>>;

    /// All scored attempts on the course's exams.
    async fn course_exam_attempts(&self, course_id: i32) -> Result<Vec<RatingAttempt>>;

    /// All solved practice tasks in the course.
    async fn course_practice_solves(&self, course_id: i32) -> Result<Vec<PracticeSolve>>;

    /// Users who have at least one attempt or one solved practice task in the
    /// course.
    async fn course_participants(&self, course_id: i32) -> Result<Vec<ReportUser>>;

    /// Course ids where the user has any activity (an attempt or a practice
    /// solve).
    async fn courses_with_activity(&self, user_id: Uuid) -> Result<Vec<i32>>;

    /// `(id, title)` for the given course ids.
    async fn courses_by_ids(&self, ids: &[i32]) -> Result<Vec<CourseRef>>;

    /// Identity of a single user.
    async fn user_by_id(&self, id: Uuid) -> Result<ReportUser>;
}
