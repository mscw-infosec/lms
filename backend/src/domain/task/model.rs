use crate::dto::task::TaskVerdict;
use crate::errors::LMSError;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashSet;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::{ValidationError, ValidationErrors};

#[derive(
    Serialize, Deserialize, FromRow, ToSchema, Eq, PartialEq, Ord, PartialOrd, Clone, Hash,
)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub task_type: TaskType,
    pub points: i64,
    pub configuration: TaskConfig,
}

#[derive(
    Serialize, Deserialize, sqlx::Type, ToSchema, Eq, PartialEq, Ord, PartialOrd, Clone, Hash,
)]
#[sqlx(type_name = "TASK_TYPE")]
#[sqlx(rename_all = "snake_case")]
pub enum TaskType {
    SingleChoice,
    MultipleChoice,
    ShortText,
    LongText,
    Ordering,
    FileUpload,
    #[serde(rename = "ctfd")]
    #[sqlx(rename = "ctfd")]
    CTFd,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
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
    #[serde(rename = "ctfd")]
    CTFd {
        task_id: usize,
    },
}

#[derive(Serialize, Deserialize, ToSchema, Eq, PartialEq, Ord, PartialOrd, Clone, Hash)]
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
        case_sensitive: bool,
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
    #[serde(rename = "ctfd")]
    CTFd {
        task_id: usize,
    },
}

pub struct TaskConfigStruct {
    pub configuration: TaskConfig,
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
                ..
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
                if answers.iter().any(|answer| {
                    // Check if any position is out of bounds
                    answer.iter().any(|&position| position >= items.len())
                        // Or if the answer does not contain all items (duplicates or missing)
                        || answer.iter().collect::<HashSet<_>>().len() != items.len()
                }) {
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

impl Task {
    /// Checks that the provided answer matches this task's type and satisfies
    /// basic constraints (e.g. text length). Does not perform any external
    /// checks (like `CTFd` solve status) - those stay in the caller.
    pub fn validate_answer(&self, answer: &TaskAnswer) -> crate::errors::Result<()> {
        match (&self.configuration, answer) {
            (
                TaskConfig::ShortText {
                    max_chars_count, ..
                },
                TaskAnswer::ShortText { answer },
            )
            | (TaskConfig::LongText { max_chars_count }, TaskAnswer::LongText { answer }) => {
                if answer.len() > *max_chars_count {
                    return Err(LMSError::ShitHappened(format!(
                        "Your answer length is more than allowed ({max_chars_count})"
                    )));
                }
                Ok(())
            }
            (TaskConfig::SingleChoice { .. }, TaskAnswer::SingleChoice { .. })
            | (TaskConfig::MultipleChoice { .. }, TaskAnswer::MultipleChoice { .. })
            | (TaskConfig::Ordering { .. }, TaskAnswer::Ordering { .. })
            | (TaskConfig::FileUpload { .. }, TaskAnswer::FileUpload { .. })
            | (TaskConfig::CTFd { .. }, TaskAnswer::CTFd) => Ok(()),
            _ => Err(LMSError::ShitHappened(
                "You've sent an answer for another task type".to_string(),
            )),
        }
    }

    /// Grades an answer against this task's configuration and returns a verdict.
    ///
    /// Types that need manual review (`LongText`, `FileUpload`, non-`auto_grade`
    /// `ShortText`) return [`TaskVerdict::OnReview`]. Callers must ensure the
    /// answer variant matches the task type (see [`Task::validate_answer`]);
    /// a mismatched pair is a programming error and panics.
    #[allow(clippy::cast_precision_loss)]
    #[allow(clippy::too_many_lines)]
    pub fn grade(&self, answer: &TaskAnswer) -> TaskVerdict {
        let points = self.points as f64;
        match (answer, &self.configuration) {
            (
                TaskAnswer::SingleChoice { answer },
                TaskConfig::SingleChoice {
                    options, correct, ..
                },
            ) => {
                if *answer == options[*correct] {
                    TaskVerdict::FullScore {
                        comment: None,
                        score: points,
                        max_score: points,
                    }
                } else {
                    TaskVerdict::Incorrect {
                        comment: None,
                        score: 0f64,
                        max_score: points,
                    }
                }
            }
            (
                TaskAnswer::MultipleChoice { answers },
                TaskConfig::MultipleChoice {
                    options,
                    correct,
                    partial_score,
                    ..
                },
            ) => {
                let correct_answers: HashSet<_> = correct.iter().map(|&i| &options[i]).collect();
                let user_answers: HashSet<_> = answers.iter().collect();

                if user_answers == correct_answers {
                    return TaskVerdict::FullScore {
                        comment: None,
                        score: points,
                        max_score: points,
                    };
                }
                if !partial_score {
                    return TaskVerdict::Incorrect {
                        comment: None,
                        score: 0f64,
                        max_score: points,
                    };
                }

                let correct_count = correct_answers.intersection(&user_answers).count() as f64;
                let incorrect_count = user_answers.difference(&correct_answers).count() as f64;
                // punish for wrong answers, not for missing
                let score_multiplier =
                    (correct_count - incorrect_count) / correct_answers.len() as f64;
                if score_multiplier <= 0f64 {
                    return TaskVerdict::Incorrect {
                        comment: None,
                        score: 0f64,
                        max_score: points,
                    };
                }

                TaskVerdict::PartialScore {
                    score: points * score_multiplier,
                    comment: None,
                    max_score: points,
                }
            }
            (
                TaskAnswer::ShortText { answer },
                TaskConfig::ShortText {
                    answers,
                    auto_grade,
                    case_sensitive,
                    ..
                },
            ) => {
                if !auto_grade {
                    return TaskVerdict::OnReview;
                }
                let matched = if *case_sensitive {
                    answers.contains(&answer.trim().to_string())
                } else {
                    let answer = answer.trim().to_lowercase();
                    answers
                        .iter()
                        .map(|x| x.to_lowercase())
                        .any(|x| x == answer)
                };
                if matched {
                    TaskVerdict::FullScore {
                        comment: None,
                        score: points,
                        max_score: points,
                    }
                } else {
                    TaskVerdict::Incorrect {
                        comment: None,
                        score: 0f64,
                        max_score: points,
                    }
                }
            }
            (TaskAnswer::Ordering { answer }, TaskConfig::Ordering { items, answers }) => {
                let precomputed_answers: Vec<Vec<String>> = answers
                    .iter()
                    .map(|correct| correct.iter().map(|&i| items[i].clone()).collect())
                    .collect();
                if precomputed_answers
                    .iter()
                    .any(|precomputed| precomputed == answer)
                {
                    TaskVerdict::FullScore {
                        comment: None,
                        score: points,
                        max_score: points,
                    }
                } else {
                    TaskVerdict::Incorrect {
                        comment: None,
                        score: 0f64,
                        max_score: points,
                    }
                }
            }
            (TaskAnswer::LongText { .. }, TaskConfig::LongText { .. })
            | (TaskAnswer::FileUpload { .. }, TaskConfig::FileUpload { .. }) => {
                TaskVerdict::OnReview
            }
            (TaskAnswer::CTFd, TaskConfig::CTFd { .. }) => {
                // if answer exists then task is solved
                TaskVerdict::FullScore {
                    comment: None,
                    score: points,
                    max_score: points,
                }
            }
            // such cases (when TaskConfig type != TaskAnswer type) just shouldn't
            // exist due to checks in validate_answer / modify_attempt
            _ => unreachable!(),
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
    #[serde(rename = "ctfd")]
    CTFd,
}

#[derive(Serialize, Deserialize)]
pub struct CtfdTaskResponse {
    pub success: bool,
    pub data: CtfdTaskData,
}

#[derive(Serialize, Deserialize)]
pub struct CtfdTaskData {
    pub name: String,
    pub description: String,
}

#[derive(Serialize, Deserialize)]
pub struct CtfdMetadataResponse {
    pub meta: CtfdMetadataContent,
}

#[derive(Serialize, Deserialize)]
pub struct CtfdUsersReponse {
    pub meta: CtfdMetadataContent,
    pub data: Vec<CtfdUser>,
}

#[derive(Serialize, Deserialize)]
pub struct CtfdUser {
    pub id: i32,
}

#[derive(Serialize, Deserialize)]
pub struct CtfdMetadataContent {
    pub pagination: CtfdPaginationContent,
}

#[derive(Serialize, Deserialize)]
pub struct CtfdPaginationContent {
    pub total: usize,
}

#[derive(Serialize, Deserialize)]
pub struct CtfdCreateUserResponse {
    pub success: bool,
    pub data: Option<CreateUserData>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateUserData {
    pub id: i32,
}
