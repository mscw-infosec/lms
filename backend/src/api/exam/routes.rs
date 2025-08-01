use crate::api::exam::ExamState;
use crate::domain::account::model::{UserModel, UserRole};
use crate::domain::exam::model::Exam;
use crate::dto::exam::{CreateExamResponseDTO, UpsertExamRequestDTO};
use crate::errors::LMSError;
use crate::utils::ValidatedJson;
use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use uuid::Uuid;

/// Create new exam
#[utoipa::path(
    post,
    tag = "Exam",
    path = "/new",
    request_body = UpsertExamRequestDTO,
    responses(
        (status = 201, body = CreateExamResponseDTO, description = "Returns created exam's id"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to create exams")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn create(
    user: UserModel,
    State(state): State<ExamState>,
    ValidatedJson(payload): ValidatedJson<UpsertExamRequestDTO>,
) -> Result<(StatusCode, Json<CreateExamResponseDTO>), LMSError> {
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't create exams".to_string()));
    }

    let exam = state.exam_service.create_exam(payload).await?;

    Ok((StatusCode::CREATED, Json(exam.into())))
}

/// Get exam by id
#[utoipa::path(
    get,
    tag = "Exam",
    path = "/{exam_id}",
    params(
        ("exam_id" = Uuid, Path)
    ),
    responses(
        (status = 200, body = Exam, description = "Found exam"),
        (status = 401, description = "No auth data found"),
        (status = 404, description = "Exam not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn get_by_id(
    State(state): State<ExamState>,
    Path(exam_id): Path<Uuid>,
) -> Result<Json<Exam>, LMSError> {
    // TODO: ACL for exams (has access to exam)
    let exam = state.exam_service.get_exam(exam_id).await?;
    Ok(Json(exam))
}

/// Delete exam by id
#[utoipa::path(
    delete,
    tag = "Exam",
    path = "/{exam_id}",
    params(
        ("exam_id" = Uuid, Path)
    ),
    responses(
        (status = 204, description = "Successfully deleted exam"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to delete exam"),
        (status = 404, description = "Exam not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn delete_exam(
    user: UserModel,
    State(state): State<ExamState>,
    Path(exam_id): Path<Uuid>,
) -> Result<StatusCode, LMSError> {
    // TODO: ACL for exams (has access to exam)
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't delete tasks".to_string()));
    }

    let () = state.exam_service.delete_exam(exam_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Update exam by id
#[utoipa::path(
    put,
    tag = "Exam",
    path = "/{exam_id}",
    params(
        ("exam_id" = Uuid, Path)
    ),
    request_body = UpsertExamRequestDTO,
    responses(
        (status = 200, description = "Successfully updated exam"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to update exam"),
        (status = 404, description = "Exam not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn update_exam(
    user: UserModel,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
    ValidatedJson(payload): ValidatedJson<UpsertExamRequestDTO>,
) -> Result<Json<Exam>, LMSError> {
    // TODO: ACL for tasks (owners)
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't update tasks".to_string()));
    }

    let exam = state.exam_service.update_exam(exam_id, payload).await?;
    Ok(exam.into())
}

/// Update exam's tasks by id
#[utoipa::path(
    put,
    tag = "Exam",
    path = "/{exam_id}/tasks",
    params(
        ("exam_id" = Uuid, Path)
    ),
    request_body = Vec<i32>,
    responses(
        (status = 200, description = "Successfully updated exam's tasks"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to update exam"),
        (status = 404, description = "Exam not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn update_exam_tasks(
    user: UserModel,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
    Json(payload): Json<Vec<i32>>,
) -> Result<(), LMSError> {
    // TODO: ACL for tasks (owners)
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't update tasks".to_string()));
    }

    let () = state.exam_service.update_tasks(exam_id, payload).await?;
    Ok(())
}
