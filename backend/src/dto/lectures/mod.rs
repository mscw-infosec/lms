use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::domain::lectures::model::{LectureModel, LectureNoteModel, TopicLectureModel};

#[derive(Deserialize, Serialize, Validate, ToSchema)]
pub struct CreateLectureRequestDTO {
    #[validate(range(min = 0, message = "Topic id must be a non-negative integer"))]
    pub topic_id: i32,

    #[validate(length(
        min = 1,
        max = 200,
        message = "Title must be between 1 and 200 characters"
    ))]
    pub title: String,

    pub description: Option<String>,

    pub content: Option<String>,

    #[validate(length(max = 20, message = "Video id must be at most 20 characters"))]
    pub video_id: Option<String>,

    #[validate(range(min = 0, message = "Order index must be a non-negative integer"))]
    pub order_index: i32,
}

#[derive(Deserialize, Serialize, Validate, ToSchema)]
pub struct UpdateLectureRequestDTO {
    #[validate(length(
        min = 1,
        max = 200,
        message = "Title must be between 1 and 200 characters"
    ))]
    pub title: String,

    pub description: Option<String>,

    pub content: Option<String>,

    #[validate(length(max = 20, message = "Video id must be at most 20 characters"))]
    pub video_id: Option<String>,

    #[validate(range(min = 0, message = "Order index must be a non-negative integer"))]
    pub order_index: i32,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct CreateLectureResponseDTO {
    pub id: i32,
}

impl From<LectureModel> for CreateLectureResponseDTO {
    fn from(value: LectureModel) -> Self {
        Self { id: value.id }
    }
}

/// Full lecture view, including the rich-text body and completion state.
///
/// The `video_id`, when present, is resolved to a playable URL through the
/// existing `GET /video/{video_id}` endpoint.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct LectureResponseDTO {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub video_id: Option<String>,
    pub completed: bool,
}

impl LectureResponseDTO {
    pub fn from_model(model: LectureModel, completed: bool) -> Self {
        Self {
            id: model.id,
            title: model.title,
            description: model.description,
            content: model.content,
            video_id: model.video_id,
            completed,
        }
    }
}

/// Lighter lecture view used when listing the lectures of a topic.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct LectureSummaryDTO {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub video_id: Option<String>,
    pub order_index: i32,
    pub completed: bool,
}

impl From<TopicLectureModel> for LectureSummaryDTO {
    fn from(value: TopicLectureModel) -> Self {
        Self {
            id: value.id,
            title: value.title,
            description: value.description,
            video_id: value.video_id,
            order_index: value.order_index,
            completed: value.completed,
        }
    }
}

#[derive(Deserialize, Serialize, Validate, ToSchema)]
pub struct UpsertLectureNoteDTO {
    #[validate(length(max = 20000, message = "Note must be at most 20000 characters"))]
    pub content: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct LectureNoteDTO {
    pub content: String,
    pub updated_at: Option<DateTime<Utc>>,
}

impl From<Option<LectureNoteModel>> for LectureNoteDTO {
    fn from(note: Option<LectureNoteModel>) -> Self {
        match note {
            Some(note) => Self {
                content: note.content,
                updated_at: Some(note.updated_at),
            },
            None => Self {
                content: String::new(),
                updated_at: None,
            },
        }
    }
}
