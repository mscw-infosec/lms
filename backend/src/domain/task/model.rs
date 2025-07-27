use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashSet;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::{ValidationError, ValidationErrors};

#[derive(Serialize, Deserialize, FromRow, ToSchema)]
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
pub enum PublicTaskConfig {
    SingleChoice {
        options: Vec<String>,
    },
    MultipleChoice {
        options: Vec<String>,
        partial_score: bool,
    },
    ShortText {
        max_chars_count: usize,
    },
    LongText {
        max_chars_count: usize,
    },
    Ordering {
        items: Vec<String>,
    },
    FileUpload {
        max_size: usize,
    },
    CTFd {
        task_id: usize,
    },
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
        max_size: usize,
    },
    CTFd {
        task_id: usize,
    },
}

impl TaskConfig {
    pub fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();

        match self {
            Self::SingleChoice {
                options, correct, ..
            } => {
                if options.is_empty() {
                    let mut error = ValidationError::new("empty_options");
                    error.message = Some("Options must not be empty".into());
                    errors.add("options", error);
                }

                if options.iter().any(String::is_empty) {
                    let mut error = ValidationError::new("empty_option");
                    error.message = Some("Option value must not be empty".into());
                    errors.add("options", error);
                }

                if *correct >= options.len() {
                    let mut error = ValidationError::new("invalid_correct_index");
                    error.message = Some("Invalid index specified for correct answer".into());
                    errors.add("correct", error);
                }
            }
            Self::MultipleChoice {
                options, correct, ..
            } => {
                if options.is_empty() {
                    let mut error = ValidationError::new("empty_options");
                    error.message = Some("Options must not be empty".into());
                    errors.add("options", error);
                }

                if options.iter().any(String::is_empty) {
                    let mut error = ValidationError::new("empty_option");
                    error.message = Some("Option value must not be empty".into());
                    errors.add("options", error);
                }

                if (*correct).iter().any(|&x| x >= options.len()) {
                    let mut error = ValidationError::new("invalid_correct_index");
                    error.message = Some("Invalid index specified for correct answer".into());
                    errors.add("correct", error);
                }
            }
            Self::ShortText {
                auto_grade,
                max_chars_count,
                answers,
            } => {
                if *auto_grade && answers.is_empty() {
                    let mut error = ValidationError::new("empty_options");
                    error.message = Some("Options must not be empty if auto_grade is on".into());
                    errors.add("answers", error);
                }
                if *max_chars_count == 0 || *max_chars_count > 500 {
                    let mut error = ValidationError::new("invalid_max_chars_count");
                    error.message = Some("Maximum chars count (500) exceeded".into());
                    errors.add("max_chars_count", error);
                }
            }
            Self::LongText { max_chars_count } => {
                if *max_chars_count == 0 || *max_chars_count > 5000 {
                    let mut error = ValidationError::new("invalid_max_chars_count");
                    error.message = Some("Maximum chars count (5000) exceeded".into());
                    errors.add("max_chars_count", error);
                }
            }
            // checking if order answers belong in items vec & all items are included in ordering
            Self::Ordering { items, answers } => {
                if answers
                    .iter()
                    .any(|answer| answer.iter().any(|&position| position >= items.len() ||
                        answer.iter().collect::<HashSet<_>>().len() != items.len()))
                {
                    let mut error = ValidationError::new("invalid_ordering");
                    error.message = Some("Invalid order index specified for answer".into());
                    errors.add("answers", error);
                }
            }
            Self::FileUpload { max_size } => {
                if *max_size == 0 || *max_size > 10 * 1024 * 1024 {
                    let mut error = ValidationError::new("invalid_file_upload");
                    error.message =
                        Some("File max size must be less than or equals to 10 MB".into());
                    errors.add("max_size", error);
                }
            }
            Self::CTFd { .. } => {} // TODO: go to CTFd to check task
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
#[serde(tag = "name", rename_all = "snake_case")]
pub enum TaskAnswer {
    SingleChoice {
        answer: String,
    },
    MultipleChoice {
        answers: Vec<String>,
    },
    ShortText {
        answer: String,
    },
    LongText {
        answer: String,
    },
    Ordering {
        answer: Vec<String>,
    },
    FileUpload {
        file_id: Uuid,
    },
}
