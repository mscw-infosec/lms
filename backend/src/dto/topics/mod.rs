use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::domain::topics::model::{TopicContentRow, TopicModel};

#[derive(Deserialize, Serialize, Validate, ToSchema)]
pub struct UpsertTopicRequestDTO {
    #[validate(length(
        min = 1,
        max = 100,
        message = "Title must be between 1 and 100 characters"
    ))]
    pub title: String,

    #[validate(range(message = "Course id must be a non-negative integer", min = 0))]
    pub course_id: i32,

    #[validate(range(message = "Order index must be a non-negative integer", min = 0))]
    pub order_index: i32,
}

#[derive(Deserialize, Serialize, ToSchema)]
pub struct TopicResponseDTO {
    pub id: i32,
    pub title: String,
    pub course_id: i32,
    pub order_index: i32,
}

impl From<TopicModel> for TopicResponseDTO {
    fn from(topic: TopicModel) -> Self {
        Self {
            id: topic.id,
            title: topic.title,
            course_id: topic.course_id,
            order_index: topic.order_index,
        }
    }
}

/// One item in a topic's unified content list.
#[derive(Deserialize, Serialize, ToSchema)]
pub struct TopicContentItemDTO {
    /// `lecture` | `practice` | `exam` | `text`.
    pub kind: String,
    /// Item id as a string (int for lecture/practice/text, uuid for exam).
    pub id: String,
    pub title: String,
    /// Full text body, only present for `text` items.
    pub content: Option<String>,
    pub order_index: i32,
}

impl From<TopicContentRow> for TopicContentItemDTO {
    fn from(row: TopicContentRow) -> Self {
        Self {
            kind: row.kind,
            id: row.item_id,
            title: row.title,
            content: row.content,
            order_index: row.order_index,
        }
    }
}

#[derive(Deserialize, Serialize, Validate, ToSchema)]
pub struct UpsertTopicTextDTO {
    #[validate(length(min = 1, max = 20000, message = "Text must be 1..20000 characters"))]
    pub content: String,
}

#[derive(Deserialize, Serialize, ToSchema)]
pub struct CreateTopicTextResponseDTO {
    pub id: i32,
}

#[derive(Deserialize, Serialize, ToSchema)]
pub struct ReorderItemDTO {
    pub kind: String,
    pub id: String,
}

#[derive(Deserialize, Serialize, ToSchema)]
pub struct ReorderTopicContentDTO {
    pub items: Vec<ReorderItemDTO>,
}
