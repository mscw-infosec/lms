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
}

#[derive(Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "EXAM_TYPE")]
pub enum ExamType {
    Instant,
    Delayed, // delayed results
}
