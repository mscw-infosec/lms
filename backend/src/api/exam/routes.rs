use crate::api::exam::ExamState;
use crate::domain::account::model::{UserModel, UserRole};
use crate::domain::exam::model::Exam;
use crate::dto::exam::{
    CreateExamResponseDTO, ExamAttempt, ExamAttemptSchema, TaskAnswerDTO, UpsertExamRequestDTO,
};
use crate::dto::task::PublicTaskDTO;
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

/// Start new attempt
#[utoipa::path(
    post,
    tag = "Exam",
    path = "/{exam_id}/attempt/start",
    params(
        ("exam_id" = Uuid, Path)
    ),
    responses(
        (status = 200, body = ExamAttemptSchema, description = "Successfully started new attempt"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to update exam"),
        (status = 404, description = "Exam not found"),
        (status = 409, description = "User can't start new attempt due to limits or another active attempt")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn start_new_attempt(
    user: UserModel,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
) -> Result<Json<ExamAttempt>, LMSError> {
    let attempt = state.exam_service.start_exam(exam_id, user.id).await?;
    Ok(Json(attempt))
}

/// Stop active attempt
#[utoipa::path(
    post,
    tag = "Exam",
    path = "/{exam_id}/attempt/stop",
    params(
        ("exam_id" = Uuid, Path)
    ),
    responses(
        (status = 200, description = "Successfully stopped an attempt"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 404, description = "Exam or attempt not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn stop_attempt(
    user: UserModel,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
) -> Result<StatusCode, LMSError> {
    let () = state.exam_service.stop_exam(exam_id, user.id).await?;
    Ok(StatusCode::OK)
}

/// Change answer for an active attempt
#[utoipa::path(
    patch,
    tag = "Exam",
    path = "/{exam_id}/attempt/patch",
    request_body = TaskAnswerDTO,
    params(
        ("exam_id" = Uuid, Path)
    ),
    responses(
        (status = 200, description = "Successfully patched"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 404, description = "Exam or attempt not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn patch_attempt(
    user: UserModel,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
    Json(answer): Json<TaskAnswerDTO>,
) -> Result<StatusCode, LMSError> {
    let _ = state
        .exam_service
        .modify_attempt(exam_id, user.id, answer.task_id, answer.answer)
        .await?;
    Ok(StatusCode::OK)
}

/// Get last attempt
#[utoipa::path(
    get,
    tag = "Exam",
    path = "/{exam_id}/attempt/last",
    params(
        ("exam_id" = Uuid, Path)
    ),
    responses(
        (status = 200, body = ExamAttemptSchema, description = "Successfully got last attempt"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 404, description = "Exam or attempt not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn get_last_attempt(
    user: UserModel,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
) -> Result<Json<ExamAttemptSchema>, LMSError> {
    let mut attempt: ExamAttemptSchema = state
        .exam_service
        .get_user_last_attempt(exam_id, user.id)
        .await?
        .into();
    if let Some(scoring_data) = attempt.scoring_data.as_mut()
        && !scoring_data.show_results
    {
        attempt.scoring_data = None;
    }

    Ok(Json(attempt))
}

/// Get exam tasks (only with active attempt or if exam scores are available)
#[utoipa::path(
    get,
    tag = "Exam",
    path = "/{exam_id}/tasks",
    params(
        ("exam_id" = Uuid, Path)
    ),
    responses(
        (status = 200, body = Vec<PublicTaskDTO>, description = "Successfully got exam's tasks"),
        (status = 401, description = "No auth data found"),
        (status = 400, description = "Wrong data format"),
        (status = 403, description = "You have no permission to view tasks"),
        (status = 404, description = "Exam not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn get_tasks(
    user: UserModel,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
) -> Result<Json<Vec<PublicTaskDTO>>, LMSError> {
    let attempts = state
        .exam_service
        .get_user_attempts(exam_id, user.id)
        .await?;
    if attempts.iter().any(|att| att.active)
        || attempts.iter().any(|att| att.scoring_data.show_results)
    {
        let mut public_tasks: Vec<PublicTaskDTO> = Vec::new();
        let tasks = state.exam_service.get_tasks(exam_id).await?;
        for task in tasks {
            public_tasks.push(task.into());
        }
        return Ok(Json(public_tasks));
    }
    Err(LMSError::Forbidden(
        "You have no permission to view tasks".to_string(),
    ))
}
