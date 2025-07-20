use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub tries_count: i64,
    pub task_type: TaskType,
    pub points: i64,
    pub configuration: TaskConfig,
}

#[derive(Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "TASK_TYPE")]
#[sqlx(rename_all = "snake_case")]
pub enum TaskType {
    SingleChoice,
    MultipleChoice,
    ShortText,
    LongText,
    Ordering,
    FileUpload,
    CTFd,
}

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(tag = "name", rename_all = "snake_case")]
pub enum TaskConfig {
    SingleChoice {
        options: Vec<String>,
        correct: usize,
        shuffle: bool,
    },
    MultipleChoice {
        options: Vec<String>,
        correct: Vec<usize>,
        shuffle: bool,
        partial_score: bool,
    },
    ShortText {
        auto_grade: bool,
        max_chars_count: usize,
        answers: Vec<String>,
    },
    LongText {
        max_chars_count: usize,
    },
    Ordering {
        items: Vec<String>,
        answers: Vec<Vec<usize>>,
    },
    FileUpload {
        max_size: String,
    },
    CTFd {
        task_id: usize,
    },
}
