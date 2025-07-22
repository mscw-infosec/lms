use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::domain::topics::model::TopicModel;

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
