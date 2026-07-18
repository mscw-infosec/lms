use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use crate::domain::exam::model::Exam;
use crate::{
    api::topics::TopicsState,
    domain::account::model::UserRole,
    dto::topics::{
        CreateTopicTextResponseDTO, ReorderTopicContentDTO, TopicContentItemDTO, TopicResponseDTO,
        UpsertTopicRequestDTO, UpsertTopicTextDTO,
    },
    errors::LMSError,
    infrastructure::jwt::AccessTokenClaim,
    utils::ValidatedJson,
};

fn ensure_staff(role: UserRole) -> Result<(), LMSError> {
    if matches!(role, UserRole::Student) {
        return Err(LMSError::Forbidden(
            "User cannot manage topic content".into(),
        ));
    }
    Ok(())
}

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

/// Get a topic's unified, ordered content list (lectures, practices, exams, texts).
#[utoipa::path(
    get,
    tag = "Topic",
    path = "/{topic_id}/content",
    params(("topic_id" = i32, Path)),
    responses(
        (status = 200, body = Vec<TopicContentItemDTO>, description = "Ordered topic content"),
        (status = 401, description = "No auth data"),
        (status = 403, description = "No access to this topic's course"),
        (status = 404, description = "Topic not found")
    ),
    security(("BearerAuth" = [])),
)]
pub async fn get_topic_content(
    claims: AccessTokenClaim,
    Path(topic_id): Path<i32>,
    State(state): State<TopicsState>,
) -> Result<Json<Vec<TopicContentItemDTO>>, LMSError> {
    let items = state
        .topic_service
        .get_topic_content(claims.sub, claims.role, topic_id)
        .await?
        .into_iter()
        .map(Into::into)
        .collect();
    Ok(Json(items))
}

/// Reorder a topic's content across all item kinds.
#[utoipa::path(
    put,
    tag = "Topic",
    path = "/{topic_id}/content/order",
    params(("topic_id" = i32, Path)),
    request_body = ReorderTopicContentDTO,
    responses(
        (status = 204, description = "Reordered"),
        (status = 400, description = "Invalid item id/kind"),
        (status = 401, description = "No auth data"),
        (status = 403, description = "User cannot manage topic content"),
        (status = 404, description = "Topic not found")
    ),
    security(("BearerAuth" = [])),
)]
pub async fn reorder_topic_content(
    claims: AccessTokenClaim,
    Path(topic_id): Path<i32>,
    State(state): State<TopicsState>,
    Json(payload): Json<ReorderTopicContentDTO>,
) -> Result<StatusCode, LMSError> {
    ensure_staff(claims.role)?;
    let items: Vec<(String, String)> = payload.items.into_iter().map(|i| (i.kind, i.id)).collect();
    state
        .topic_service
        .reorder_topic_content(claims.sub, claims.role, topic_id, &items)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Add a text item to a topic.
#[utoipa::path(
    post,
    tag = "Topic",
    path = "/{topic_id}/text",
    params(("topic_id" = i32, Path)),
    request_body = UpsertTopicTextDTO,
    responses(
        (status = 201, body = CreateTopicTextResponseDTO, description = "Text created"),
        (status = 400, description = "Invalid data"),
        (status = 401, description = "No auth data"),
        (status = 403, description = "User cannot manage topic content"),
        (status = 404, description = "Topic not found")
    ),
    security(("BearerAuth" = [])),
)]
pub async fn create_topic_text(
    claims: AccessTokenClaim,
    Path(topic_id): Path<i32>,
    State(state): State<TopicsState>,
    ValidatedJson(payload): ValidatedJson<UpsertTopicTextDTO>,
) -> Result<(StatusCode, Json<CreateTopicTextResponseDTO>), LMSError> {
    ensure_staff(claims.role)?;
    let id = state
        .topic_service
        .create_topic_text(claims.sub, claims.role, topic_id, payload.content)
        .await?;
    Ok((StatusCode::CREATED, Json(CreateTopicTextResponseDTO { id })))
}

/// Update a topic text item.
#[utoipa::path(
    put,
    tag = "Topic",
    path = "/{topic_id}/text/{text_id}",
    params(("topic_id" = i32, Path), ("text_id" = i32, Path)),
    request_body = UpsertTopicTextDTO,
    responses(
        (status = 204, description = "Text updated"),
        (status = 400, description = "Invalid data"),
        (status = 401, description = "No auth data"),
        (status = 403, description = "User cannot manage topic content"),
        (status = 404, description = "Topic not found")
    ),
    security(("BearerAuth" = [])),
)]
pub async fn update_topic_text(
    claims: AccessTokenClaim,
    Path((topic_id, text_id)): Path<(i32, i32)>,
    State(state): State<TopicsState>,
    ValidatedJson(payload): ValidatedJson<UpsertTopicTextDTO>,
) -> Result<StatusCode, LMSError> {
    ensure_staff(claims.role)?;
    state
        .topic_service
        .update_topic_text(claims.sub, claims.role, topic_id, text_id, payload.content)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Delete a topic text item.
#[utoipa::path(
    delete,
    tag = "Topic",
    path = "/{topic_id}/text/{text_id}",
    params(("topic_id" = i32, Path), ("text_id" = i32, Path)),
    responses(
        (status = 204, description = "Text deleted"),
        (status = 401, description = "No auth data"),
        (status = 403, description = "User cannot manage topic content"),
        (status = 404, description = "Topic not found")
    ),
    security(("BearerAuth" = [])),
)]
pub async fn delete_topic_text(
    claims: AccessTokenClaim,
    Path((topic_id, text_id)): Path<(i32, i32)>,
    State(state): State<TopicsState>,
) -> Result<StatusCode, LMSError> {
    ensure_staff(claims.role)?;
    state
        .topic_service
        .delete_topic_text(claims.sub, claims.role, topic_id, text_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
