use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

/// Paginated + searchable leaderboard query.
#[derive(Serialize, Deserialize, ToSchema, Validate)]
pub struct LeaderboardQuery {
    #[validate(range(min = 1, max = 100))]
    pub limit: i32,
    #[validate(range(min = 0))]
    pub offset: i32,
    /// Case-insensitive substring match on username or email.
    #[serde(default)]
    pub search: Option<String>,
}

/// A user's score within a single course (used in the overall breakdown).
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CourseScoreDTO {
    pub course_id: i32,
    pub title: String,
    pub earned: f64,
    pub max: f64,
    pub percent: f64,
}

/// A user's overall rating across every course they have activity in.
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UserOverallRatingDTO {
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub total_earned: f64,
    pub total_max: f64,
    pub percent: f64,
    pub courses: Vec<CourseScoreDTO>,
}

/// One ranked participant in a course leaderboard.
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct LeaderboardEntryDTO {
    pub rank: usize,
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub earned: f64,
    pub max: f64,
    pub percent: f64,
}

/// A page of a course leaderboard: participants ranked by earned score.
/// `total` is the number of participants matching the search (for pagination),
/// while `entries` holds only the requested page.
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CourseLeaderboardDTO {
    pub course_id: i32,
    pub title: String,
    pub max: f64,
    pub total: i64,
    pub entries: Vec<LeaderboardEntryDTO>,
}

/// One line of a per-course, per-user breakdown (one exam or one practice).
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct RatingBreakdownItemDTO {
    /// `"exam"` or `"practice"`.
    pub kind: String,
    /// Exam UUID or practice id, as a string.
    pub id: String,
    pub title: String,
    pub earned: f64,
    pub max: f64,
}

/// A single user's detailed rating within one course.
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CourseUserRatingDTO {
    pub course_id: i32,
    pub title: String,
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub earned: f64,
    pub max: f64,
    pub percent: f64,
    pub breakdown: Vec<RatingBreakdownItemDTO>,
}
