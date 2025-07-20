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

impl Into<CreateTaskResponseDTO> for Task {
    fn into(self) -> CreateTaskResponseDTO {
        CreateTaskResponseDTO { id: self.id }
    }
}

impl Into<TaskConfig> for JsonValue {
    fn into(self) -> TaskConfig {
        from_value(self).expect("Invalid JSON for TaskConfig")
    }
}
