use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::domain::video::model::VideoModel;

#[derive(Serialize, Deserialize, Validate)]
pub struct CreateVideoRequestDTO {
    #[validate(range(min = 1, message = "size: file size should be positive"))]
    pub size: i64,

    #[validate(length(min = 1, message = "name: file name should be positive"))]
    pub name: String,
}

#[derive(Serialize, Deserialize, Validate, ToSchema)]
pub struct CreateVideoResponseDTO {
    #[validate(url)]
    pub url: String,
}

impl From<VideoModel> for CreateVideoResponseDTO {
    fn from(value: VideoModel) -> Self {
        Self { url: value.url }
    }
}
