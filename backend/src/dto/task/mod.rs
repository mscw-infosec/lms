use crate::domain::exam::model::{ExamExtendedEntity, TextEntity};
use crate::domain::task::model::{PublicTaskConfig, Task, TaskAnswer, TaskConfig, TaskType};
use serde::{Deserialize, Serialize};
use serde_json::from_value;
use sqlx::FromRow;
use sqlx::types::JsonValue;
use utoipa::ToSchema;
use validator::Validate;

#[derive(Serialize, Deserialize, ToSchema, Validate)]
pub struct UpsertTaskRequestDTO {
    #[validate(length(max = 50))]
    pub title: String,
    pub description: Option<String>,
    pub task_type: TaskType,
    #[validate(range(min = 0))]
    pub points: i32,
    #[validate(nested)]
    pub configuration: TaskConfig,
}

#[derive(Serialize, Deserialize, ToSchema, Validate)]
pub struct LimitOffsetDTO {
    #[validate(range(min = 0, max = 20))]
    pub limit: i32,
    #[validate(range(min = 0))]
    pub offset: i32,
}

#[derive(Serialize, Deserialize, ToSchema, Validate)]
pub struct TaskId {
    #[validate(range(min = 1))]
    pub id: i32,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct PublicTaskDTO {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub task_type: TaskType,
    pub points: i64,
    pub configuration: PublicTaskConfig,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PubExamExtendedEntity {
    Task { task: PublicTaskDTO },
    Text { text: TextEntity },
}

impl From<ExamExtendedEntity> for PubExamExtendedEntity {
    fn from(value: ExamExtendedEntity) -> Self {
        match value {
            ExamExtendedEntity::Task { task } => Self::Task { task: task.into() },
            ExamExtendedEntity::Text { text } => Self::Text { text },
        }
    }
}

impl From<Task> for PublicTaskDTO {
    fn from(value: Task) -> Self {
        Self {
            id: value.id,
            title: value.title,
            description: value.description,
            task_type: value.task_type,
            points: value.points,
            configuration: value.configuration.into(),
        }
    }
}

impl From<TaskConfig> for PublicTaskConfig {
    fn from(value: TaskConfig) -> Self {
        match value {
            TaskConfig::SingleChoice { options, .. } => Self::SingleChoice { options },

            TaskConfig::MultipleChoice {
                options,
                partial_score,
                ..
            } => Self::MultipleChoice {
                options,
                partial_score,
            },

            TaskConfig::ShortText {
                max_chars_count, ..
            } => Self::ShortText { max_chars_count },

            TaskConfig::LongText { max_chars_count } => Self::LongText { max_chars_count },

            TaskConfig::Ordering { items, .. } => Self::Ordering { items },

            TaskConfig::FileUpload { max_size } => Self::FileUpload { max_size },

            TaskConfig::CTFd { task_id } => Self::CTFd { task_id },
        }
    }
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

impl From<JsonValue> for TaskAnswer {
    fn from(val: JsonValue) -> Self {
        from_value(val).expect("Invalid JSON for TaskAnswer")
    }
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
#[serde(tag = "verdict", rename_all = "snake_case")]
pub enum TaskVerdict {
    FullScore {
        comment: Option<String>, // for manual review
        score: f64,
        max_score: f64,
    },
    PartialScore {
        comment: Option<String>,
        score: f64,
        max_score: f64,
    },
    Incorrect {
        comment: Option<String>,
        score: f64,
        max_score: f64,
    },
    OnReview,
}

impl TaskVerdict {
    pub const fn score(&self) -> &f64 {
        match self {
            Self::FullScore { score, .. }
            | Self::PartialScore { score, .. }
            | Self::Incorrect { score, .. } => score,
            Self::OnReview => &0f64,
        }
    }
}
