use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, sqlx::Type)]
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

#[derive(Serialize, Deserialize)]
#[serde(tag = "name", rename_all = "snake_case")]
pub enum TaskConfig {
    SingleChoice {
        pretty_name: String,
        options: Vec<String>,
        correct: usize,
        shuffle: bool,
    },
    MultipleChoice {
        pretty_name: String,
        options: Vec<String>,
        correct: Vec<usize>,
        shuffle: bool,
        partial_score: bool,
    },
    ShortText {
        pretty_name: String,
        auto_grade: bool,
        max_chars_count: usize,
        answers: Vec<String>,
    },
    LongText {
        pretty_name: String,
        max_chars_count: usize,
    },
    Ordering {
        pretty_name: String,
        items: Vec<String>,
        answers: Vec<Vec<usize>>,
    },
    FileUpload {
        pretty_name: String,
        max_size: String,
    },
    CTFd {
        pretty_name: String,
        task_id: usize,
    },
}
