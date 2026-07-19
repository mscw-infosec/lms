use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use crate::domain::account::model::UserRole;
use crate::domain::task::model::TaskAnswer;
use crate::dto::task::UpsertTaskRequestDTO;
use crate::infrastructure::jwt::AccessTokenClaim;
use crate::{
    api::practice::PracticeState,
    dto::practice::{
        CreatePracticeRequestDTO, CreatePracticeResponseDTO, PracticeAdminDTO, PracticeDetailDTO,
        PracticeSubmitResultDTO, PracticeSummaryDTO, UpdatePracticeRequestDTO,
    },
    dto::task::CreateTaskResponseDTO,
    errors::LMSError,
    utils::ValidatedJson,
};

fn ensure_staff(role: UserRole) -> Result<(), LMSError> {
    if matches!(role, UserRole::Student) {
        return Err(LMSError::Forbidden(
            "You can't manage practices".to_string(),
        ));
    }
    Ok(())
}

/// Create a new practice inside a topic.
#[utoipa::path(
    post,
    tag = "Practice",
    path = "/new",
    request_body = CreatePracticeRequestDTO,
    responses(
        (status = 201, body = CreatePracticeResponseDTO, description = "Practice created"),
        (status = 400, description = "Invalid data"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to manage practices"),
        (status = 404, description = "Topic not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn create_practice(
    claims: AccessTokenClaim,
    State(state): State<PracticeState>,
    ValidatedJson(payload): ValidatedJson<CreatePracticeRequestDTO>,
) -> Result<(StatusCode, Json<CreatePracticeResponseDTO>), LMSError> {
    ensure_staff(claims.role)?;
    let practice = state
        .practice_service
        .create_practice(claims.sub, claims.role, payload)
        .await?;
    Ok((StatusCode::CREATED, Json(practice.into())))
}

/// List practices in a topic with the caller's aggregate progress.
#[utoipa::path(
    get,
    tag = "Practice",
    path = "/topic/{topic_id}",
    params(("topic_id" = i32, Path)),
    responses(
        (status = 200, body = Vec<PracticeSummaryDTO>, description = "Practices in the topic"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no access to this topic's course"),
        (status = 404, description = "Topic not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn list_in_topic(
    claims: AccessTokenClaim,
    Path(topic_id): Path<i32>,
    State(state): State<PracticeState>,
) -> Result<Json<Vec<PracticeSummaryDTO>>, LMSError> {
    let practices = state
        .practice_service
        .list_in_topic(claims.sub, claims.role, topic_id)
        .await?
        .into_iter()
        .map(Into::into)
        .collect();
    Ok(Json(practices))
}

/// Get a practice with its ordered tasks and the caller's progress.
#[utoipa::path(
    get,
    tag = "Practice",
    path = "/{id}",
    params(("id" = i32, Path)),
    responses(
        (status = 200, body = PracticeDetailDTO, description = "Practice with tasks"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no access to this practice"),
        (status = 404, description = "Practice not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn get_practice(
    claims: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<PracticeState>,
) -> Result<Json<PracticeDetailDTO>, LMSError> {
    let (practice, rows) = state
        .practice_service
        .get_practice(claims.sub, claims.role, id)
        .await?;
    Ok(Json(PracticeDetailDTO {
        id: practice.id,
        title: practice.title,
        description: practice.description,
        order_index: practice.order_index,
        tasks: rows.into_iter().map(Into::into).collect(),
    }))
}

/// Get a practice with full tasks (for editing). Teacher/admin only.
#[utoipa::path(
    get,
    tag = "Practice",
    path = "/{id}/admin",
    params(("id" = i32, Path)),
    responses(
        (status = 200, body = PracticeAdminDTO, description = "Practice with full tasks"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission"),
        (status = 404, description = "Practice not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn get_practice_admin(
    claims: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<PracticeState>,
) -> Result<Json<PracticeAdminDTO>, LMSError> {
    ensure_staff(claims.role)?;
    let (practice, tasks) = state
        .practice_service
        .get_practice_admin(claims.sub, claims.role, id)
        .await?;
    Ok(Json(PracticeAdminDTO {
        id: practice.id,
        title: practice.title,
        description: practice.description,
        order_index: practice.order_index,
        tasks,
    }))
}

/// Update a practice's metadata.
#[utoipa::path(
    put,
    tag = "Practice",
    path = "/{id}",
    params(("id" = i32, Path)),
    request_body = UpdatePracticeRequestDTO,
    responses(
        (status = 204, description = "Practice updated"),
        (status = 400, description = "Invalid data"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission"),
        (status = 404, description = "Practice not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn update_practice(
    claims: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<PracticeState>,
    ValidatedJson(payload): ValidatedJson<UpdatePracticeRequestDTO>,
) -> Result<StatusCode, LMSError> {
    ensure_staff(claims.role)?;
    state
        .practice_service
        .update_practice(claims.sub, claims.role, id, payload)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Delete a practice and all of its tasks.
#[utoipa::path(
    delete,
    tag = "Practice",
    path = "/{id}",
    params(("id" = i32, Path)),
    responses(
        (status = 204, description = "Practice deleted"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission"),
        (status = 404, description = "Practice not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn delete_practice(
    claims: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<PracticeState>,
) -> Result<StatusCode, LMSError> {
    ensure_staff(claims.role)?;
    state
        .practice_service
        .delete_practice(claims.sub, claims.role, id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Create a new (auto-gradable) task inside a practice.
#[utoipa::path(
    post,
    tag = "Practice",
    path = "/{id}/task",
    params(("id" = i32, Path)),
    request_body = UpsertTaskRequestDTO,
    responses(
        (status = 201, body = CreateTaskResponseDTO, description = "Task created in practice"),
        (status = 400, description = "Task is not auto-gradable / invalid data"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission"),
        (status = 404, description = "Practice not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn create_task(
    claims: AccessTokenClaim,
    Path(id): Path<i32>,
    State(state): State<PracticeState>,
    ValidatedJson(payload): ValidatedJson<UpsertTaskRequestDTO>,
) -> Result<(StatusCode, Json<CreateTaskResponseDTO>), LMSError> {
    ensure_staff(claims.role)?;
    let task = state
        .practice_service
        .create_task(claims.sub, claims.role, id, payload)
        .await?;
    Ok((StatusCode::CREATED, Json(task.into())))
}

/// Update a task inside a practice.
#[utoipa::path(
    put,
    tag = "Practice",
    path = "/{id}/task/{task_id}",
    params(("id" = i32, Path), ("task_id" = i32, Path)),
    request_body = UpsertTaskRequestDTO,
    responses(
        (status = 204, description = "Task updated"),
        (status = 400, description = "Task is not auto-gradable / invalid data"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission"),
        (status = 404, description = "Practice or task not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn update_task(
    claims: AccessTokenClaim,
    Path((id, task_id)): Path<(i32, i32)>,
    State(state): State<PracticeState>,
    ValidatedJson(payload): ValidatedJson<UpsertTaskRequestDTO>,
) -> Result<StatusCode, LMSError> {
    ensure_staff(claims.role)?;
    state
        .practice_service
        .update_task(claims.sub, claims.role, id, task_id, payload)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Remove (and delete) a task from a practice.
#[utoipa::path(
    delete,
    tag = "Practice",
    path = "/{id}/task/{task_id}",
    params(("id" = i32, Path), ("task_id" = i32, Path)),
    responses(
        (status = 204, description = "Task removed"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission"),
        (status = 404, description = "Practice not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn remove_task(
    claims: AccessTokenClaim,
    Path((id, task_id)): Path<(i32, i32)>,
    State(state): State<PracticeState>,
) -> Result<StatusCode, LMSError> {
    ensure_staff(claims.role)?;
    state
        .practice_service
        .remove_task(claims.sub, claims.role, id, task_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Submit an answer to a practice task. Unlimited attempts, immediate verdict.
#[utoipa::path(
    post,
    tag = "Practice",
    path = "/task/{task_id}/submit",
    params(("task_id" = i32, Path)),
    request_body = TaskAnswer,
    responses(
        (status = 200, body = PracticeSubmitResultDTO, description = "Graded submission with updated progress"),
        (status = 400, description = "Answer does not match the task type"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no access to this practice task"),
        (status = 404, description = "Task is not available for practice")
    ),
    security(("BearerAuth" = []))
)]
pub async fn submit(
    claims: AccessTokenClaim,
    Path(task_id): Path<i32>,
    State(state): State<PracticeState>,
    Json(answer): Json<TaskAnswer>,
) -> Result<Json<PracticeSubmitResultDTO>, LMSError> {
    let (verdict, progress, solution) = state
        .practice_service
        .submit(claims.sub, claims.role, task_id, answer)
        .await?;
    Ok(Json(PracticeSubmitResultDTO::new(
        verdict, &progress, solution,
    )))
}
