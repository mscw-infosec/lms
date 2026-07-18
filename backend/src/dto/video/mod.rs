use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::domain::video::model::VideoModel;

#[derive(Serialize, Deserialize, Validate, ToSchema)]
pub struct CreateVideoRequestDTO {
    #[validate(range(min = 1, message = "size: file size should be positive"))]
    pub size: i64,

    #[validate(length(min = 1, message = "name: file name should be positive"))]
    pub name: String,
}

#[derive(Serialize, Deserialize, Validate, ToSchema)]
pub struct CreateVideoResponseDTO {
    /// Id of the created video entity. Store this (e.g. on a lecture) to
    /// reference the video later; it becomes playable once the upload to `url`
    /// finishes and Yandex transcodes it.
    pub id: String,

    /// TUS (resumable) upload URL the client should upload the file bytes to.
    #[validate(url)]
    pub url: String,
}

impl From<VideoModel> for CreateVideoResponseDTO {
    fn from(value: VideoModel) -> Self {
        Self {
            id: value.id,
            url: value.url,
        }
    }
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct GetVideoUrlResponseDTO {
    url: String,
}

impl From<String> for GetVideoUrlResponseDTO {
    fn from(value: String) -> Self {
        Self { url: value }
    }
}
