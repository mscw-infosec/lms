use crate::domain::task::model::Task;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Serialize, Deserialize, FromRow, ToSchema)]
#[allow(clippy::struct_field_names)]
pub struct Exam {
    pub id: Uuid,
    pub topic_id: i32,
    pub tries_count: i32,
    pub duration: i32,
    pub name: String,
    pub description: Option<String>,
    pub r#type: ExamType,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub scoring_policy: ExamScoringPolicy,
}

#[derive(Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "EXAM_TYPE")]
pub enum ExamType {
    Instant,
    Delayed, // delayed results
}

/// How a user's multiple attempts at an exam are collapsed into a single score
/// for the rating. Chosen by the teacher when creating/editing the exam.
#[derive(Serialize, Deserialize, sqlx::Type, ToSchema, Clone, Copy, Default, Debug)]
#[sqlx(type_name = "EXAM_SCORING_POLICY")]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ExamScoringPolicy {
    /// Highest-scoring attempt.
    #[default]
    Best,
    /// Most recent attempt.
    Latest,
    /// Mean across all attempts.
    Average,
}

#[derive(
    Serialize, Deserialize, FromRow, ToSchema, Eq, PartialEq, Ord, PartialOrd, Clone, Hash,
)]
pub struct TextEntity {
    pub id: Uuid,
    pub text: String,
}

#[derive(Serialize, Deserialize, sqlx::Type, ToSchema, Debug)]
#[sqlx(type_name = "EXAM_ENTITY_TYPE")]
#[sqlx(rename_all = "lowercase")]
pub enum ExamEntityType {
    Task,
    Text,
}

#[derive(Serialize, Deserialize, ToSchema, Eq, PartialEq, Ord, PartialOrd, Clone, Hash)]
#[serde(tag = "name", rename_all = "snake_case")]
pub enum ExamEntity {
    Task { id: i32 },
    Text { id: Uuid },
}

#[derive(Serialize, Deserialize, ToSchema, Eq, PartialEq, Ord, PartialOrd, Clone, Hash)]
#[serde(tag = "name", rename_all = "snake_case")]
pub enum ExamExtendedEntity {
    Task { task: Task },
    Text { text: TextEntity },
}
