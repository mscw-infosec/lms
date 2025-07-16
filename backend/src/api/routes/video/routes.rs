use std::sync::Arc;

use axum::{Json, extract::State};

use crate::{
    api::{
        dto::video::{CreateVideoRequestDTO, CreateVideoResponseDTO},
        routes::video::VideoState,
    },
    errors::Result,
    utils::ValidatedJson,
};

/// Creates new video entity and return TUS url for uploading
#[utoipa::path(
    post,
    path = "/new",
    tag = "Video",
    responses(
        (status = 200, body = CreateVideoResponseDTO)
    ),
    security(
        ("CookieAuth" = [])
    )
)]
pub async fn create(
    State(state): State<Arc<VideoState>>,
    ValidatedJson(payload): ValidatedJson<CreateVideoRequestDTO>,
) -> Result<Json<CreateVideoResponseDTO>> {
    let video = state.video_service.create(payload).await?;
    let response = video.into();
    Ok(Json(response))
}
