use crate::api::task::TaskState;
use crate::domain::account::model::{UserModel, UserRole};
use crate::domain::task::model::{Task, TaskConfig};
use crate::dto::task::{CreateTaskResponseDTO, PublicTaskDTO, UpsertTaskRequestDTO};
use crate::errors::LMSError;
use crate::utils::ValidatedJson;
use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use rand::prelude::SliceRandom;
use rand::rng;

/// Create new task
#[utoipa::path(
    post,
    tag = "Task",
    path = "/new",
    request_body = UpsertTaskRequestDTO,
    responses(
        (status = 201, body = CreateTaskResponseDTO, description = "Returns created task's id"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to create tasks")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn create(
    user: UserModel,
    State(state): State<TaskState>,
    ValidatedJson(payload): ValidatedJson<UpsertTaskRequestDTO>,
) -> Result<(StatusCode, Json<CreateTaskResponseDTO>), LMSError> {
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't create tasks".to_string()));
    }

    let task = state.task_service.create_task(payload).await?;

    Ok((StatusCode::CREATED, task.into()))
}

/// Get task by id
#[utoipa::path(
    get,
    tag = "Task",
    path = "/{task_id}",
    params(
        ("task_id" = i32, Path)
    ),
    responses(
        (status = 200, body = PublicTaskDTO, description = "Found task"),
        (status = 401, description = "No auth data found"),
        (status = 404, description = "Task not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn get_by_id(
    State(state): State<TaskState>,
    Path(task_id): Path<i32>,
) -> Result<Json<PublicTaskDTO>, LMSError> {
    // TODO: ACL for tasks (owners + hidden tasks)
    let mut task = state.task_service.get_task(task_id).await?;
    match &mut task.configuration {
        TaskConfig::SingleChoice {
            options, shuffle, ..
        }
        | TaskConfig::MultipleChoice {
            options, shuffle, ..
        } if *shuffle => {
            options.shuffle(&mut rng());
        }
        _ => {}
    }
    Ok(Json(task.into()))
}

/// Delete task by id
#[utoipa::path(
    delete,
    tag = "Task",
    path = "/{task_id}",
    params(
        ("task_id" = i32, Path)
    ),
    responses(
        (status = 204, description = "Successfully deleted task"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to delete task"),
        (status = 404, description = "Task not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn delete_task(
    user: UserModel,
    State(state): State<TaskState>,
    Path(task_id): Path<i32>,
) -> Result<StatusCode, LMSError> {
    // TODO: ACL for tasks (owners)
    // TODO: mark for deletion and ask confirmation (now only on frontend)
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't delete tasks".to_string()));
    }

    let () = state.task_service.delete_task(task_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Update task by id
#[utoipa::path(
    put,
    tag = "Task",
    path = "/{task_id}",
    params(
        ("task_id" = i32, Path)
    ),
    request_body = UpsertTaskRequestDTO,
    responses(
        (status = 200, description = "Successfully updated task"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to update task"),
        (status = 404, description = "Task not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn update_task(
    user: UserModel,
    State(state): State<TaskState>,
    Path(task_id): Path<i32>,
    ValidatedJson(payload): ValidatedJson<UpsertTaskRequestDTO>,
) -> Result<Json<Task>, LMSError> {
    // TODO: ACL for tasks (owners)
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't update tasks".to_string()));
    }

    let task = state.task_service.update_task(task_id, payload).await?;
    Ok(task.into())
}
