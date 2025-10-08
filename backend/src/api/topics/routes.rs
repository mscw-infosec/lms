use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use crate::{
    api::topics::TopicsState,
    domain::account::model::UserRole,
    dto::topics::{TopicResponseDTO, UpsertTopicRequestDTO},
    errors::LMSError,
    infrastructure::jwt::AccessTokenClaim,
    utils::ValidatedJson,
};
use crate::{domain::exam::model::Exam, dto::entity::GetEntitiesForTopicResponseDto};

/// Retrieves a specific topic by its ID.
#[utoipa::path(
    get,
    tag = "Topic",
    path = "/{id}",
    responses(
        (status = 200, body = TopicResponseDTO, description = "Topic found"),
        (status = 404, description = "Topic not found"),
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn get_topic_by_id(
    claims: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<TopicsState>,
) -> Result<Json<TopicResponseDTO>, LMSError> {
    let topic = state
        .topic_service
        .get_topic_by_id(claims.sub, claims.role, id)
        .await?;
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
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn delete_topic(
    claims: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<TopicsState>,
) -> Result<StatusCode, LMSError> {
    if matches!(claims.role, UserRole::Student) {
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
    claims: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<TopicsState>,
    ValidatedJson(topic): ValidatedJson<UpsertTopicRequestDTO>,
) -> Result<StatusCode, LMSError> {
    if matches!(claims.role, UserRole::Student) {
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
    claims: AccessTokenClaim,
    State(state): State<TopicsState>,
    ValidatedJson(topic): ValidatedJson<UpsertTopicRequestDTO>,
) -> Result<StatusCode, LMSError> {
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden("User cannot add topics".into()));
    }

    state.topic_service.add_topic_to_course(topic).await?;

    Ok(StatusCode::CREATED)
}

/// Get topic exams
#[utoipa::path(
    get,
    tag = "Topic",
    path = "/{topic_id}/exams",
    params(
        ("topic_id", Path)
    ),
    responses(
        (status = 200, description = "Exams listed"),
        (status = 400, description = "Invalid request data"),
        (status = 401, description = "No auth data")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn get_exams(
    claims: AccessTokenClaim,
    Path(topic_id): Path<i32>,
    State(state): State<TopicsState>,
) -> Result<Json<Vec<Exam>>, LMSError> {
    Ok(Json(
        state
            .topic_service
            .get_exams(claims.sub, claims.role, topic_id)
            .await?,
    ))
}

//get topic entities
#[utoipa::path(
    get,
    tag = "Topic",
    path = "/{topic_id}/entities",
    params(
        ("topic_id", Path)
    ),
    responses(
        (status = 200, description = "Entities listed"),
        (status = 400, description = "Invalid request data"),
        (status = 401, description = "No auth data")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn get_entities(
    _claims: AccessTokenClaim,
    Path(topic_id): Path<i32>,
    State(state): State<TopicsState>,
) -> Result<Json<GetEntitiesForTopicResponseDto>, LMSError> {
    Ok(Json(GetEntitiesForTopicResponseDto {
        entities: state.entity_service.get_by_topic_id(topic_id).await?,
    }))
}
