use crate::domain::exam::model::{Exam, ExamType};
use crate::domain::task::model::TaskAnswer;
use crate::dto::task::TaskVerdict;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use sqlx::types::{Json, JsonValue};
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Serialize, Deserialize, ToSchema, Validate)]
pub struct UpsertExamRequestDTO {
    pub topic_id: i32,
    pub name: String,
    pub description: Option<String>,
    pub tries_count: i32,
    pub duration: i32,
    pub r#type: ExamType,
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

#[derive(Serialize, Deserialize, FromRow, Clone)]
pub struct ExamAttempt {
    pub id: Uuid,
    pub exam_id: Uuid,
    pub user_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub answer_data: Json<ExamAnswer>,
    pub scoring_data: Json<ScoringData>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct TaskAnswerDTO {
    pub task_id: usize,
    pub answer: TaskAnswer,
}

#[derive(Serialize, Deserialize, FromRow, ToSchema, Clone, Default)]
pub struct ScoringData {
    pub show_results: bool, // true when exam type is instant
    pub results: HashMap<usize, TaskVerdict>,
}

#[derive(Serialize, Deserialize, FromRow, ToSchema, Default)]
pub struct ExamAttemptSchema {
    pub id: Uuid,
    pub exam_id: Uuid,
    pub user_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub active: bool,
    pub answer_data: ExamAnswer,
    pub scoring_data: Option<ScoringData>,
    pub score: Option<f64>,
    pub max_score: i64,
}

#[derive(Serialize, Deserialize, FromRow, ToSchema)]
pub struct ExamAttemptsListDTO {
    pub ran_out_of_attempts: bool,
    pub attempts_left: i64,
    pub attempts: Vec<ExamAttemptSchema>,
}

impl From<ExamAttempt> for ExamAttemptSchema {
    fn from(value: ExamAttempt) -> Self {
        Self {
            id: value.id,
            exam_id: value.exam_id,
            user_id: value.user_id,
            started_at: value.started_at,
            active: value.ends_at > Utc::now(),
            answer_data: value.answer_data.into(),
            scoring_data: Some(value.scoring_data.into()),
            ..Default::default()
        }
    }
}

#[derive(Serialize, Deserialize, ToSchema, FromRow, Clone, Default)]
pub struct ExamAnswer {
    pub answers: HashMap<usize, TaskAnswer>,
}

impl From<JsonValue> for ExamAnswer {
    fn from(value: Value) -> Self {
        serde_json::from_value(value).expect("Failed to parse exam answer")
    }
}

impl From<Json<Self>> for ExamAnswer {
    fn from(value: Json<Self>) -> Self {
        Self {
            answers: value.answers.clone(),
        }
    }
}

impl From<Json<Self>> for ScoringData {
    fn from(value: Json<Self>) -> Self {
        Self {
            show_results: value.show_results,
            results: value.results.clone(),
        }
    }
}
