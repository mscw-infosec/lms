use crate::api::task::TaskState;
use crate::domain::account::model::{UserModel, UserRole};
use crate::dto::task::{CreateTaskRequestDTO, CreateTaskResponseDTO};
use crate::errors::LMSError;
use crate::utils::ValidatedJson;
use axum::extract::State;
use axum::Json;

/// Create new task
#[utoipa::path(
    post,
    tag = "Task",
    path = "/new",
    request_body = CreateTaskRequestDTO,
    responses(
        (status = 200, body = CreateTaskResponseDTO, description = "Returns created task's id"),
        (status = 403, description = "User has no permission to create tasks")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn create(
    user: UserModel,
    State(state): State<TaskState>,
    ValidatedJson(payload): ValidatedJson<CreateTaskRequestDTO>,
) -> Result<Json<CreateTaskResponseDTO>, LMSError> {
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can not create tasks".to_string()));
    }

    let task = state.task_service.create(payload).await?;

    Ok(Json(task.into()))
}
