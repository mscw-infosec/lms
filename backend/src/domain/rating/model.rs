use crate::domain::exam::model::ExamScoringPolicy;
use crate::dto::exam::ScoringData;
use chrono::{DateTime, Utc};
use sqlx::prelude::FromRow;
use sqlx::types::Json;
use uuid::Uuid;

/// One exam task reachable within a course, tagged with the owning exam's
/// scoring policy. Produced by [`RatingRepository::course_exam_tasks`].
#[derive(FromRow, Debug, Clone)]
pub struct CourseExamTask {
    pub exam_id: Uuid,
    pub exam_name: String,
    pub scoring_policy: ExamScoringPolicy,
    pub task_id: i32,
    pub points: i64,
}

/// One practice task reachable within a course. Produced by
/// [`RatingRepository::course_practice_tasks`].
#[derive(FromRow, Debug, Clone)]
pub struct CoursePracticeTask {
    pub practice_id: i32,
    pub practice_name: String,
    pub task_id: i32,
    pub points: i64,
}

/// A scored exam attempt, scoped to a course's exams. Only the fields needed to
/// compute a rating are fetched.
#[derive(FromRow, Clone)]
pub struct RatingAttempt {
    pub exam_id: Uuid,
    pub user_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub scoring_data: Json<ScoringData>,
}

/// A single solved practice task by a user.
#[derive(FromRow, Debug, Clone)]
pub struct PracticeSolve {
    pub user_id: Uuid,
    pub task_id: i32,
}

/// `(id, title)` of a course, used for the overall breakdown.
#[derive(FromRow, Debug, Clone)]
pub struct CourseRef {
    pub id: i32,
    pub title: String,
}
