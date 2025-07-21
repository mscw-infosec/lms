use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::domain::courses::model::CourseModel;

#[derive(Serialize, Deserialize, ToSchema, Validate)]
pub struct UpsertCourseRequestDTO {
    #[validate(length(
        min = 1,
        max = 100,
        message = "Name must be between 1 and 100 characters long."
    ))]
    pub name: String,

    #[validate(length(
        max = 500,
        message = "Description must be at most 500 characters long."
    ))]
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UpsertCourseResponseDTO {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<CourseModel> for UpsertCourseResponseDTO {
    fn from(course: CourseModel) -> Self {
        Self {
            id: course.id,
            name: course.title,
            description: course.description,
            created_at: course.created_at,
        }
    }
}
