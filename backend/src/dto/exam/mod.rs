use crate::domain::exam::model::{Exam, ExamType};
use crate::domain::task::model::TaskAnswer;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use sqlx::types::JsonValue;
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Serialize, Deserialize, ToSchema, Validate)]
pub struct UpsertExamRequestDTO {
    pub topic_id: i32,
    pub tries_count: i32,
    pub duration: i32,
    pub exam_type: ExamType,
}

#[derive(Serialize, Deserialize, ToSchema, FromRow)]
pub struct CreateExamResponseDTO {
    pub id: Uuid,
}

impl From<Exam> for CreateExamResponseDTO {
    fn from(val: Exam) -> Self {
        Self { id: val.id }
    }
}

#[derive(Serialize, Deserialize, ToSchema, FromRow)]
pub struct ExamAttempt {
    pub id: Uuid,
    pub exam_id: Uuid,
    pub user_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub active: bool,
    pub answer_data: ExamAnswer,
}

#[derive(Serialize, Deserialize, ToSchema, FromRow)]
pub struct ExamAnswer {
    pub answers: HashMap<usize, TaskAnswer>,
}

impl From<JsonValue> for ExamAnswer {
    fn from(value: Value) -> Self {
        serde_json::from_value(value).expect("Failed to parse exam answer")
    }
}
