use axum::{
    Json,
    extract::{Path, State},
};

use crate::{
    api::routes::video::VideoState,
    domain::account::model::{UserModel, UserRole},
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
        (status = 200, body = CreateVideoResponseDTO)
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn create(
    user: UserModel,
    State(state): State<VideoState>,
    ValidatedJson(payload): ValidatedJson<CreateVideoRequestDTO>,
) -> Result<Json<CreateVideoResponseDTO>> {
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden(
            "You can not upload or create videos".to_string(),
        ));
    }

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
    State(state): State<VideoState>,
) -> Result<Json<GetVideoUrlResponseDTO>> {
    let url = state.video_service.get_player_url(video_id).await?;
    let response = url.into();
    Ok(Json(response))
}
