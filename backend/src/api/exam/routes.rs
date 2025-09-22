use crate::api::exam::ExamState;
use crate::domain::account::model::UserRole;
use crate::domain::exam::model::{Exam, ExamEntity, ExamExtendedEntity, TextEntity};
use crate::domain::task::model::TaskConfig;
use crate::dto::exam::{
    CreateExamResponseDTO, ExamAttempt, ExamAttemptSchema, ExamAttemptsListDTO, TaskAnswerDTO,
    TextUpsertDTO, UpsertExamRequestDTO,
};
use crate::dto::task::{PubExamExtendedEntity, TaskVerdict};
use crate::errors::LMSError;
use crate::infrastructure::jwt::AccessTokenClaim;
use crate::utils::ValidatedJson;
use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use chrono::Utc;
use rand::prelude::SliceRandom;
use rand::rng;
use std::cmp::max;
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
    claims: AccessTokenClaim,
    State(state): State<ExamState>,
    ValidatedJson(payload): ValidatedJson<UpsertExamRequestDTO>,
) -> Result<(StatusCode, Json<CreateExamResponseDTO>), LMSError> {
    if matches!(claims.role, UserRole::Student) {
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
    claims: AccessTokenClaim,
    State(state): State<ExamState>,
    Path(exam_id): Path<Uuid>,
) -> Result<StatusCode, LMSError> {
    // TODO: ACL for exams (has access to exam)
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't delete exams".to_string()));
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
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
    ValidatedJson(payload): ValidatedJson<UpsertExamRequestDTO>,
) -> Result<Json<Exam>, LMSError> {
    // TODO: ACL for tasks (owners)
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't update exams".to_string()));
    }

    let exam = state.exam_service.update_exam(exam_id, payload).await?;
    Ok(exam.into())
}

/// Update exam's entities
#[utoipa::path(
    put,
    tag = "Exam",
    path = "/{exam_id}/entities",
    params(
        ("exam_id" = Uuid, Path)
    ),
    request_body = Vec<ExamEntity>,
    responses(
        (status = 200, description = "Successfully updated exam's entities"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to update exam"),
        (status = 404, description = "Exam not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn update_exam_entities(
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
    Json(payload): Json<Vec<ExamEntity>>,
) -> Result<(), LMSError> {
    // TODO: ACL for tasks (owners)
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden(
            "You can't update exam entities".to_string(),
        ));
    }

    let () = state.exam_service.update_entities(exam_id, payload).await?;
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
        .get_user_last_attempt(exam_id, claims.sub)
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
        (status = 404, description = "Exam not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
#[allow(clippy::cast_sign_loss)]
#[allow(clippy::cast_possible_wrap)]
pub async fn get_user_exam_attempts(
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
) -> Result<Json<ExamAttemptsListDTO>, LMSError> {
    let exam: Exam = state.exam_service.get_exam(exam_id).await?;
    let exam_attempts: Vec<ExamAttempt> = state
        .exam_service
        .get_user_attempts(exam_id, claims.sub)
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

/// Get exam tasks (only with active attempt or if exam scores are available or if admin)
#[utoipa::path(
    get,
    tag = "Exam",
    path = "/{exam_id}/entities",
    params(
        ("exam_id" = Uuid, Path)
    ),
    responses(
        (status = 200, body = Vec<PubExamExtendedEntity>, description = "Successfully got exam's entities"),
        (status = 401, description = "No auth data found"),
        (status = 400, description = "Wrong data format"),
        (status = 403, description = "You have no permission to view entities"),
        (status = 404, description = "Exam not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn get_entities(
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ExamState>,
) -> Result<Json<Vec<PubExamExtendedEntity>>, LMSError> {
    let attempts = state
        .exam_service
        .get_user_attempts(exam_id, claims.sub)
        .await?;
    if attempts.iter().any(|att| att.ends_at > Utc::now())
        || attempts.iter().any(|att| att.scoring_data.show_results)
        || matches!(claims.role, UserRole::Admin | UserRole::Teacher)
    {
        let entities = state.exam_service.get_entities(exam_id).await?;
        let mut public_entities: Vec<PubExamExtendedEntity> = Vec::new();
        for entity in entities {
            match entity.clone() {
                ExamExtendedEntity::Task { mut task } => {
                    match &mut task.configuration {
                        TaskConfig::SingleChoice {
                            options, shuffle, ..
                        }
                        | TaskConfig::MultipleChoice {
                            options, shuffle, ..
                        } if *shuffle => {
                            options.shuffle(&mut rng());
                        }
                        TaskConfig::Ordering { items, .. } => {
                            items.shuffle(&mut rng());
                        }
                        _ => {}
                    }
                    public_entities.push(PubExamExtendedEntity::Task { task: task.into() });
                }
                ExamExtendedEntity::Text { .. } => {
                    public_entities.push(entity.into());
                }
            }
        }
        return Ok(Json(public_entities));
    }
    Err(LMSError::Forbidden(
        "You have no permission to view tasks".to_string(),
    ))
}

/// Create new text
#[utoipa::path(
    post,
    tag = "Exam",
    path = "/text/new",
    request_body = TextUpsertDTO,
    responses(
        (status = 201, description = "Successfully created text", body = TextEntity),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You can't create texts")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn create_text(
    claims: AccessTokenClaim,
    State(state): State<ExamState>,
    ValidatedJson(text): ValidatedJson<TextUpsertDTO>,
) -> Result<(StatusCode, Json<TextEntity>), LMSError> {
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't create texts".to_string()));
    }
    let text_entity = state.exam_service.create_text(text.text).await?;
    Ok((StatusCode::CREATED, Json(text_entity)))
}

/// Update text by id
#[utoipa::path(
    put,
    tag = "Exam",
    path = "/text/{text_id}",
    params(
        ("text_id" = Uuid, Path)
    ),
    request_body = TextUpsertDTO,
    responses(
        (status = 200, description = "Successfully updated text", body = TextEntity),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You can't update texts"),
        (status = 404, description = "Text not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn update_text(
    claims: AccessTokenClaim,
    State(state): State<ExamState>,
    Path(text_id): Path<Uuid>,
    ValidatedJson(text): ValidatedJson<TextUpsertDTO>,
) -> Result<Json<TextEntity>, LMSError> {
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't update texts".to_string()));
    }
    let text_entity = state.exam_service.update_text(text_id, text.text).await?;
    Ok(Json(text_entity))
}

/// Delete text by id
#[utoipa::path(
    delete,
    tag = "Exam",
    path = "/text/{text_id}",
    responses(
        (status = 204, description = "Successfully deleted text"),
        (status = 400, description = "Wrong data format"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You can't delete texts"),
        (status = 404, description = "Text not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn delete_text(
    claims: AccessTokenClaim,
    State(state): State<ExamState>,
    Path(text_id): Path<Uuid>,
) -> Result<StatusCode, LMSError> {
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't delete texts".to_string()));
    }
    let () = state.exam_service.delete_text(text_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
