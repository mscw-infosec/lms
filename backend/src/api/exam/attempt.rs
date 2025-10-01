use crate::api::exam::ExamState;
use crate::domain::account::model::UserRole;
use crate::domain::exam::model::{Exam, ExamExtendedEntity};
use crate::dto::exam::{
    AttemptListingQuery, AttemptVisibilityPatchRequest, ExamAttempt, ExamAttemptAdminSchema,
    ExamAttemptSchema, ExamAttemptsListDTO, TaskAnswerDTO, TaskVerdictPatchRequest,
};
use crate::dto::task::TaskVerdict;
use crate::errors::LMSError;
use crate::infrastructure::jwt::AccessTokenClaim;
use crate::utils::ValidatedQuery;
use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use std::cmp::max;
use uuid::Uuid;

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
        (status = 409, description = "User can't start new attempt due to limits or another active attempt or due to exam starts_at/ends_at timespan")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn start_new_attempt(
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
) -> Result<Json<ExamAttempt>, LMSError> {
    let attempt = state.exam_service.start_exam(exam_id, claims.sub).await?;
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
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
) -> Result<StatusCode, LMSError> {
    let () = state.exam_service.stop_exam(exam_id, claims.sub).await?;
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
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
    Json(answer): Json<TaskAnswerDTO>,
) -> Result<StatusCode, LMSError> {
    let _ = state
        .exam_service
        .modify_attempt(exam_id, claims.sub, answer.task_id, answer.answer)
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
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
) -> Result<Json<ExamAttemptSchema>, LMSError> {
    let mut attempt: ExamAttemptSchema = state
        .exam_service
        .get_user_last_attempt_in_exam(exam_id, claims.sub)
        .await?
        .into();
    let entities = state.exam_service.get_entities(exam_id).await?;
    let tasks = entities
        .iter()
        .filter_map(|e| match e {
            ExamExtendedEntity::Task { task } => Some(task),
            ExamExtendedEntity::Text { .. } => None,
        })
        .collect::<Vec<_>>();

    attempt.max_score = tasks.iter().map(|t| t.points).sum();
    if let Some(scoring_data) = attempt.scoring_data.as_mut() {
        if scoring_data.show_results {
            attempt.score = Some(
                scoring_data
                    .results
                    .values()
                    .map(TaskVerdict::score)
                    .sum::<f64>(),
            );
        } else {
            attempt.scoring_data = None;
        }
    }

    Ok(Json(attempt))
}

/// Get user attempts for exam
#[utoipa::path(
    get,
    tag = "Exam",
    path = "/{exam_id}/attempt/list",
    params(
        ("exam_id" = Uuid, Path)
    ),
    responses(
        (status = 200, body = ExamAttemptsListDTO, description = "Successfully got attempts list"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 404, description = "Exam / task / attempt not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
#[allow(clippy::cast_sign_loss)]
#[allow(clippy::cast_possible_wrap)]
pub async fn get_self_exam_attempts(
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
) -> Result<Json<ExamAttemptsListDTO>, LMSError> {
    let exam: Exam = state
        .exam_service
        .get_exam(exam_id, claims.sub, claims.role)
        .await?;
    let exam_attempts: Vec<ExamAttempt> = state
        .exam_service
        .get_user_attempts_in_exam(exam_id, claims.sub)
        .await?;
    let mut attempts: Vec<ExamAttemptSchema> = exam_attempts
        .iter()
        .map(|x| ExamAttemptSchema::from(x.clone()))
        .collect();
    let entities = state.exam_service.get_entities(exam_id).await?;
    let tasks = entities
        .iter()
        .filter_map(|e| match e {
            ExamExtendedEntity::Task { task } => Some(task),
            ExamExtendedEntity::Text { .. } => None,
        })
        .collect::<Vec<_>>();

    let max_score: i64 = tasks.iter().map(|t| t.points).sum();
    for attempt in &mut attempts {
        attempt.max_score = max_score;
        if let Some(scoring_data) = attempt.scoring_data.as_mut() {
            if scoring_data.show_results {
                attempt.score = Some(
                    scoring_data
                        .results
                        .values()
                        .map(TaskVerdict::score)
                        .sum::<f64>(),
                );
            } else {
                attempt.scoring_data = None;
            }
        }
    }

    Ok(Json(ExamAttemptsListDTO {
        attempts_left: max(i64::from(exam.tries_count) - attempts.len() as i64, 0),
        ran_out_of_attempts: exam.tries_count != 0 && attempts.len() >= exam.tries_count as usize,
        attempts,
    }))
}

/// List attempts by exams for admin
#[utoipa::path(
    get,
    tag = "Exam",
    path = "/{exam_id}/admin/attempt/list",
    params(
        ("exam_id" = Uuid, Path),
        ("limit" = i32, Query),
        ("offset" = i32, Query),
        ("ungraded_first" = bool, Query)
    ),
    responses(
        (status = 200, body = Vec<ExamAttemptAdminSchema>, description = "Successfully got attempts list"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You have no permissions (teacher / admin) to access this endpoint"),
        (status = 404, description = "Exam not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn get_attempts_by_exam(
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
    ValidatedQuery(query): ValidatedQuery<AttemptListingQuery>,
) -> Result<Json<Vec<ExamAttemptAdminSchema>>, LMSError> {
    if !matches!(claims.role, UserRole::Teacher | UserRole::Admin) {
        return Err(LMSError::Forbidden(
            "Student can't access admin endpoints".to_string(),
        ));
    }
    let _ = state
        .exam_service
        .get_exam(exam_id, claims.sub, claims.role)
        .await?;
    let exam_attempts: Vec<ExamAttempt> = state
        .exam_service
        .get_exam_attempts(exam_id, query.limit, query.offset, query.ungraded_first)
        .await?;
    let attempts: Vec<ExamAttemptAdminSchema> = exam_attempts
        .iter()
        .map(|x| ExamAttemptAdminSchema::from(x.clone()))
        .collect();

    Ok(Json(attempts))
}

/// Patch verdict for user's attempt
#[utoipa::path(
    patch,
    tag = "Exam",
    path = "/{exam_id}/admin/attempt/verdict/{attempt_id}",
    params(
        ("exam_id" = Uuid, Path),
        ("attempt_id" = Uuid, Path)
    ),
    request_body = TaskVerdictPatchRequest,
    responses(
        (status = 200, description = "Successfully patched attempt verdict"),
        (status = 400, description = "Wrong data format / invalid score"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You have no permissions (teacher / admin) to access this endpoint"),
        (status = 404, description = "Exam / attempt / task not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn patch_attempt_task_verdict(
    claims: AccessTokenClaim,
    Path((exam_id, attempt_id)): Path<(Uuid, Uuid)>,
    State(state): State<ExamState>,
    Json(patch_request): Json<TaskVerdictPatchRequest>,
) -> Result<(), LMSError> {
    if !matches!(claims.role, UserRole::Teacher | UserRole::Admin) {
        return Err(LMSError::Forbidden(
            "Student can't access admin endpoints".to_string(),
        ));
    }
    state
        .exam_service
        .update_attempt_verdict(
            attempt_id,
            exam_id,
            patch_request.task_id,
            patch_request.verdict,
        )
        .await?;

    Ok(())
}

/// Change `show_results` for an attempt by id
#[utoipa::path(
    patch,
    tag = "Exam",
    path = "/admin/attempt/visibility/{attempt_id}",
    params(
        ("attempt_id" = Uuid, Path)
    ),
    request_body = AttemptVisibilityPatchRequest,
    responses(
        (status = 200, description = "Successfully changed attempt visibility"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You have no permissions (teacher / admin) to access this endpoint")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn change_visibility_for_attempt_by_id(
    claims: AccessTokenClaim,
    Path(attempt_id): Path<Uuid>,
    State(state): State<ExamState>,
    Json(patch_request): Json<AttemptVisibilityPatchRequest>,
) -> Result<(), LMSError> {
    if !matches!(claims.role, UserRole::Teacher | UserRole::Admin) {
        return Err(LMSError::Forbidden(
            "Student can't access admin endpoints".to_string(),
        ));
    }
    state
        .exam_service
        .update_attempt_visibility_by_id(attempt_id, patch_request.show_results)
        .await?;

    Ok(())
}

/// Change `show_results` for all attempts in an exam
#[utoipa::path(
    patch,
    tag = "Exam",
    path = "/{exam_id}/admin/attempt/visibility",
    params(
        ("exam_id" = Uuid, Path)
    ),
    request_body = AttemptVisibilityPatchRequest,
    responses(
        (status = 200, description = "Successfully changed attempt visibility"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You have no permissions (teacher / admin) to access this endpoint")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn change_visibility_for_attempts_by_exam(
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
    Json(patch_request): Json<AttemptVisibilityPatchRequest>,
) -> Result<(), LMSError> {
    if !matches!(claims.role, UserRole::Teacher | UserRole::Admin) {
        return Err(LMSError::Forbidden(
            "Student can't access admin endpoints".to_string(),
        ));
    }
    state
        .exam_service
        .update_attempts_visibility_by_exam(exam_id, patch_request.show_results)
        .await?;

    Ok(())
}
