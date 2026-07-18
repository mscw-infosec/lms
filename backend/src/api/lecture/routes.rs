use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use crate::infrastructure::jwt::AccessTokenClaim;
use crate::{
    api::lecture::LectureState,
    domain::account::model::UserRole,
    dto::lectures::{
        CreateLectureRequestDTO, CreateLectureResponseDTO, LectureResponseDTO, LectureSummaryDTO,
        UpdateLectureRequestDTO,
    },
    errors::LMSError,
    utils::ValidatedJson,
};

/// Create a new lecture inside a topic.
#[utoipa::path(
    post,
    tag = "Lecture",
    path = "/new",
    request_body = CreateLectureRequestDTO,
    responses(
        (status = 201, body = CreateLectureResponseDTO, description = "Lecture created"),
        (status = 400, description = "Invalid request data"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to create lectures"),
        (status = 404, description = "Topic or referenced video not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn create(
    claims: AccessTokenClaim,
    State(state): State<LectureState>,
    ValidatedJson(payload): ValidatedJson<CreateLectureRequestDTO>,
) -> Result<(StatusCode, Json<CreateLectureResponseDTO>), LMSError> {
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't create lectures".to_string()));
    }

    let lecture = state
        .lecture_service
        .create_lecture(claims.sub, claims.role, payload)
        .await?;

    Ok((StatusCode::CREATED, Json(lecture.into())))
}

/// Get a lecture by id, including its content and completion state.
#[utoipa::path(
    get,
    tag = "Lecture",
    path = "/{id}",
    params(
        ("id" = i32, Path)
    ),
    responses(
        (status = 200, body = LectureResponseDTO, description = "Lecture found"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no access to this lecture's course"),
        (status = 404, description = "Lecture not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn get_by_id(
    claims: AccessTokenClaim,
    State(state): State<LectureState>,
    Path(id): Path<i32>,
) -> Result<Json<LectureResponseDTO>, LMSError> {
    let (lecture, completed) = state
        .lecture_service
        .get_lecture(claims.sub, claims.role, id)
        .await?;

    Ok(Json(LectureResponseDTO::from_model(lecture, completed)))
}

/// List all lectures of a topic (ordered), with the caller's completion state.
#[utoipa::path(
    get,
    tag = "Lecture",
    path = "/topic/{topic_id}",
    params(
        ("topic_id" = i32, Path)
    ),
    responses(
        (status = 200, body = Vec<LectureSummaryDTO>, description = "Lectures in the topic"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no access to this topic's course"),
        (status = 404, description = "Topic not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn list_in_topic(
    claims: AccessTokenClaim,
    State(state): State<LectureState>,
    Path(topic_id): Path<i32>,
) -> Result<Json<Vec<LectureSummaryDTO>>, LMSError> {
    let lectures = state
        .lecture_service
        .list_in_topic(claims.sub, claims.role, topic_id)
        .await?
        .into_iter()
        .map(Into::into)
        .collect();

    Ok(Json(lectures))
}

/// Update a lecture by id.
#[utoipa::path(
    put,
    tag = "Lecture",
    path = "/{id}",
    params(
        ("id" = i32, Path)
    ),
    request_body = UpdateLectureRequestDTO,
    responses(
        (status = 204, description = "Lecture updated"),
        (status = 400, description = "Invalid request data"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to update lectures"),
        (status = 404, description = "Lecture or referenced video not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn update(
    claims: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<LectureState>,
    ValidatedJson(payload): ValidatedJson<UpdateLectureRequestDTO>,
) -> Result<StatusCode, LMSError> {
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't update lectures".to_string()));
    }

    state
        .lecture_service
        .update_lecture(claims.sub, claims.role, id, payload)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Delete a lecture by id.
#[utoipa::path(
    delete,
    tag = "Lecture",
    path = "/{id}",
    params(
        ("id" = i32, Path)
    ),
    responses(
        (status = 204, description = "Lecture deleted"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to delete lectures"),
        (status = 404, description = "Lecture not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn delete(
    claims: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<LectureState>,
) -> Result<StatusCode, LMSError> {
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't delete lectures".to_string()));
    }

    state
        .lecture_service
        .delete_lecture(claims.sub, claims.role, id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Mark a lecture as completed for the current user.
#[utoipa::path(
    post,
    tag = "Lecture",
    path = "/{id}/complete",
    params(
        ("id" = i32, Path)
    ),
    responses(
        (status = 204, description = "Lecture marked as completed"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no access to this lecture's course"),
        (status = 404, description = "Lecture not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn complete(
    claims: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<LectureState>,
) -> Result<StatusCode, LMSError> {
    state
        .lecture_service
        .mark_completed(claims.sub, claims.role, id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
