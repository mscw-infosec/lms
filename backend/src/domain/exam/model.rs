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
}

#[derive(Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "EXAM_TYPE")]
#[serde(rename_all = "UPPERCASE")]
pub enum ExamType {
    Instant,
    Delayed,
}
