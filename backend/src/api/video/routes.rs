use axum::{
    Json,
    extract::{Path, State},
};

use crate::infrastructure::jwt::AccessTokenClaim;
use crate::{
    api::video::VideoState,
    domain::account::model::UserRole,
    dto::video::{CreateVideoRequestDTO, CreateVideoResponseDTO, GetVideoUrlResponseDTO},
    errors::{LMSError, Result},
    utils::ValidatedJson,
};

/// Creates new video entity and return TUS url for uploading
#[utoipa::path(
    post,
    path = "/new",
    tag = "Video",
    request_body = CreateVideoRequestDTO,
    responses(
        (status = 200, body = CreateVideoResponseDTO),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to upload videos")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn create(
    claims: AccessTokenClaim,
    State(state): State<VideoState>,
    ValidatedJson(payload): ValidatedJson<CreateVideoRequestDTO>,
) -> Result<Json<CreateVideoResponseDTO>> {
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden(
            "You can't upload or create videos".to_string(),
        ));
    }

    let video = state.video_service.create(payload).await?;
    Ok(Json(video.into()))
}

/// Return video player url by video id
#[utoipa::path(
    get,
    path = "/{video_id}",
    tag = "Video",
    responses(
        (status = 200, body = GetVideoUrlResponseDTO),
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn get_video_url(
    Path(video_id): Path<String>,
    State(state): State<VideoState>,
) -> Result<Json<GetVideoUrlResponseDTO>> {
    // TODO: add ACL for videos
    let url = state.video_service.get_player_url(video_id).await?;
    Ok(Json(url.into()))
}
