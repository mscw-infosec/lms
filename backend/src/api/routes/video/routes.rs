use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
};

use crate::{
    api::{
        dto::video::{CreateVideoRequestDTO, CreateVideoResponseDTO, GetVideoUrlResponseDTO},
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

/// Return video player url by video id
#[utoipa::path(
    get,
    path = "/{video_id}",
    tag = "Video",
    responses(
        (status = 200, body = GetVideoUrlResponseDTO)
    ),
    security(
        ("CookieAuth" = [])
    )
)]
pub async fn get_video_url(
    Path(video_id): Path<String>,
    State(state): State<Arc<VideoState>>,
) -> Result<Json<GetVideoUrlResponseDTO>> {
    let url = state.video_service.get_player_url(video_id).await?;
    let response = url.into();
    Ok(Json(response))
}
