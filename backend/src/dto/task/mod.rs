use crate::domain::task::model::{Task, TaskConfig, TaskType};
use serde::{Deserialize, Serialize};
use serde_json::from_value;
use sqlx::types::JsonValue;
use sqlx::FromRow;
use utoipa::ToSchema;
use validator::Validate;

#[derive(Serialize, Deserialize, ToSchema, Validate)]
pub struct CreateTaskRequestDTO {
    pub title: String,
    pub description: Option<String>,
    pub tries_count: i32,
    pub task_type: TaskType,
    pub points: i32,
    pub configuration: TaskConfig,
}

#[derive(Serialize, Deserialize, ToSchema, FromRow)]
pub struct CreateTaskResponseDTO {
    pub id: i64,
}

impl From<Task> for CreateTaskResponseDTO {
    fn from(val: Task) -> Self {
        Self { id: val.id }
    }
}

impl From<JsonValue> for TaskConfig {
    fn from(val: JsonValue) -> Self {
        from_value(val).expect("Invalid JSON for TaskConfig")
    }
}
