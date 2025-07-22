use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use crate::{
    api::topics::TopicsState,
    domain::account::model::{UserModel, UserRole},
    dto::topics::{TopicResponseDTO, UpsertTopicRequestDTO},
    errors::LMSError,
    infrastructure::jwt::AccessTokenClaim,
    utils::ValidatedJson,
};

/// Retrieves a specific topic by its ID.
#[utoipa::path(
    get,
    tag = "Topic",
    path = "/{id}",
    responses(
        (status = 200, body = TopicResponseDTO, description = "Topic found"),
        (status = 404, description = "Topic not found"),
    ),
)]
pub async fn get_topic_by_id(
    // TODO: Start using proper ACL
    _: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<TopicsState>,
) -> Result<Json<TopicResponseDTO>, LMSError> {
    let topic = state.topic_service.get_topic_by_id(id).await?;
    Ok(Json(topic.into()))
}

/// Deletes a topic by its ID.
#[utoipa::path(
    delete,
    tag = "Topic",
    path = "/{id}",
    responses(
        (status = 204, description = "Topic deleted successfully"),
        (status = 404, description = "Topic not found"),
    ),
)]
pub async fn delete_topic(
    user: UserModel,
    Path(id): Path<i32>,
    State(state): State<TopicsState>,
) -> Result<StatusCode, LMSError> {
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("User cannot delete topics".into()));
    }

    state.topic_service.delete_topic(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Updates a topic by its ID.
#[utoipa::path(
    put,
    tag = "Topic",
    path = "/{id}",
    request_body = UpsertTopicRequestDTO,
    responses(
        (status = 204, description = "Topic updated successfully"),
        (status = 400, description = "Invalid request data"),
        (status = 403, description = "Forbidden: User cannot update topics"),
        (status = 404, description = "Topic not found"),
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn update_topic(
    user: UserModel,
    Path(id): Path<i32>,
    State(state): State<TopicsState>,
    ValidatedJson(topic): ValidatedJson<UpsertTopicRequestDTO>,
) -> Result<StatusCode, LMSError> {
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("User cannot update topics".into()));
    }

    state.topic_service.update_topic(id, topic).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Adds a new topic to a course.
#[utoipa::path(
    post,
    tag = "Topic",
    path = "/new",
    request_body = UpsertTopicRequestDTO,
    responses(
        (status = 201, description = "Topic added successfully"),
        (status = 400, description = "Invalid request data"),
        (status = 403, description = "Forbidden: User cannot add topics"),
        (status = 404, description = "Course not found")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn add_topic_to_course(
    user: UserModel,
    State(state): State<TopicsState>,
    ValidatedJson(topic): ValidatedJson<UpsertTopicRequestDTO>,
) -> Result<StatusCode, LMSError> {
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("User cannot add topics".into()));
    }

    state.topic_service.add_topic_to_course(topic).await?;

    Ok(StatusCode::CREATED)
}
