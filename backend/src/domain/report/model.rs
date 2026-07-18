use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

/// Minimal user identity needed for a gradebook row.
#[derive(FromRow, Debug, Clone)]
pub struct ReportUser {
    pub id: Uuid,
    pub username: String,
    pub email: String,
}

#[derive(Serialize, Deserialize, ToSchema, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AttemptStatus {
    /// The attempt window is still open.
    InProgress,
    /// The attempt is scored but at least one task awaits manual review.
    OnReview,
    /// Fully graded.
    Graded,
}

/// One learner attempt in an exam gradebook.
#[derive(Serialize, Deserialize, ToSchema, Debug, Clone)]
pub struct GradebookRow {
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub attempt_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub score: f64,
    pub status: AttemptStatus,
}

/// Aggregate statistics across all attempts of an exam.
#[derive(Serialize, Deserialize, ToSchema, Debug, Clone)]
pub struct GradebookSummary {
    pub total_attempts: usize,
    pub participants: usize,
    pub graded: usize,
    pub on_review: usize,
    pub in_progress: usize,
    pub average_score: f64,
    pub highest_score: f64,
    pub lowest_score: f64,
}

/// Full exam gradebook: metadata, per-attempt rows and summary stats.
#[derive(Serialize, Deserialize, ToSchema, Debug, Clone)]
pub struct Gradebook {
    pub exam_id: Uuid,
    pub exam_name: String,
    pub max_score: i64,
    pub rows: Vec<GradebookRow>,
    pub summary: GradebookSummary,
}

/// A rendered export ready to be streamed as an HTTP file response.
pub struct ExportFile {
    pub bytes: Vec<u8>,
    pub content_type: &'static str,
    pub filename: String,
}
