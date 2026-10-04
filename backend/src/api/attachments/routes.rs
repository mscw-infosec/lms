use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use uuid::Uuid;

use crate::infrastructure::jwt::AccessTokenClaim;
use crate::{
    api::attachments::AttachmentState,
    domain::{
        account::model::UserRole,
        attachments::{
            model::AttachmentOwner,
            service::{DOWNLOAD_URL_TTL_SECS, UPLOAD_URL_TTL_SECS},
        },
    },
    dto::attachments::{
        AttachmentDTO, AttachmentDownloadDTO, AttachmentUploadDTO, RequestAttachmentUploadDTO,
    },
    errors::LMSError,
    utils::ValidatedJson,
};

fn ensure_staff(claims: &AccessTokenClaim) -> Result<(), LMSError> {
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden(
            "You can't manage additional materials".to_string(),
        ));
    }
    Ok(())
}

async fn list(
    claims: &AccessTokenClaim,
    state: &AttachmentState,
    owner: AttachmentOwner,
) -> Result<Json<Vec<AttachmentDTO>>, LMSError> {
    let attachments = state
        .attachment_service
        .list(claims.sub, claims.role, owner)
        .await?
        .into_iter()
        .map(Into::into)
        .collect();

    Ok(Json(attachments))
}

async fn start_upload(
    claims: &AccessTokenClaim,
    state: &AttachmentState,
    owner: AttachmentOwner,
    payload: RequestAttachmentUploadDTO,
) -> Result<(StatusCode, Json<AttachmentUploadDTO>), LMSError> {
    ensure_staff(claims)?;
    let (attachment, presigned) = state
        .attachment_service
        .start_upload(claims.sub, claims.role, owner, payload.into())
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(AttachmentUploadDTO {
            attachment_id: attachment.id,
            url: presigned.url,
            fields: presigned.fields,
            expires_in: UPLOAD_URL_TTL_SECS,
        }),
    ))
}

/// List additional materials of a lecture.
#[utoipa::path(
    get,
    tag = "Attachment",
    path = "/lecture/{lecture_id}",
    params(
        ("lecture_id" = i32, Path)
    ),
    responses(
        (status = 200, body = Vec<AttachmentDTO>, description = "Files attached to the lecture"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no access to this lecture's course"),
        (status = 404, description = "Lecture not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn list_lecture(
    claims: AccessTokenClaim,
    State(state): State<AttachmentState>,
    Path(lecture_id): Path<i32>,
) -> Result<Json<Vec<AttachmentDTO>>, LMSError> {
    list(&claims, &state, AttachmentOwner::Lecture(lecture_id)).await
}

/// Start uploading a file to a lecture: returns a presigned POST to storage.
#[utoipa::path(
    post,
    tag = "Attachment",
    path = "/lecture/{lecture_id}",
    params(
        ("lecture_id" = i32, Path)
    ),
    request_body = RequestAttachmentUploadDTO,
    responses(
        (status = 201, body = AttachmentUploadDTO, description = "Upload started"),
        (status = 400, description = "Invalid request data"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to manage materials"),
        (status = 404, description = "Lecture not found"),
        (status = 413, description = "File is over the size limit")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn upload_lecture(
    claims: AccessTokenClaim,
    State(state): State<AttachmentState>,
    Path(lecture_id): Path<i32>,
    ValidatedJson(payload): ValidatedJson<RequestAttachmentUploadDTO>,
) -> Result<(StatusCode, Json<AttachmentUploadDTO>), LMSError> {
    start_upload(
        &claims,
        &state,
        AttachmentOwner::Lecture(lecture_id),
        payload,
    )
    .await
}

/// List additional materials of a task (exam or practice).
#[utoipa::path(
    get,
    tag = "Attachment",
    path = "/task/{task_id}",
    description = "Students can list a task's files when it is in a practice they can access, \
                   or in an exam whose tasks they can currently view.",
    params(
        ("task_id" = i32, Path)
    ),
    responses(
        (status = 200, body = Vec<AttachmentDTO>, description = "Files attached to the task"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no access to this task"),
        (status = 404, description = "Task not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn list_task(
    claims: AccessTokenClaim,
    State(state): State<AttachmentState>,
    Path(task_id): Path<i32>,
) -> Result<Json<Vec<AttachmentDTO>>, LMSError> {
    list(&claims, &state, AttachmentOwner::Task(task_id)).await
}

/// Start uploading a file to a task (exam or practice): returns a presigned POST to storage.
#[utoipa::path(
    post,
    tag = "Attachment",
    path = "/task/{task_id}",
    params(
        ("task_id" = i32, Path)
    ),
    request_body = RequestAttachmentUploadDTO,
    responses(
        (status = 201, body = AttachmentUploadDTO, description = "Upload started"),
        (status = 400, description = "Invalid request data"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to manage materials"),
        (status = 404, description = "Task not found"),
        (status = 413, description = "File is over the size limit")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn upload_task(
    claims: AccessTokenClaim,
    State(state): State<AttachmentState>,
    Path(task_id): Path<i32>,
    ValidatedJson(payload): ValidatedJson<RequestAttachmentUploadDTO>,
) -> Result<(StatusCode, Json<AttachmentUploadDTO>), LMSError> {
    start_upload(&claims, &state, AttachmentOwner::Task(task_id), payload).await
}

/// Confirm that the browser finished uploading a file to storage.
#[utoipa::path(
    post,
    tag = "Attachment",
    path = "/{id}/complete",
    params(
        ("id" = Uuid, Path)
    ),
    responses(
        (status = 200, body = AttachmentDTO, description = "File is attached"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to manage materials"),
        (status = 404, description = "Upload not found"),
        (status = 409, description = "The file is not in storage yet"),
        (status = 413, description = "File is over the size limit")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn complete_upload(
    claims: AccessTokenClaim,
    State(state): State<AttachmentState>,
    Path(id): Path<Uuid>,
) -> Result<Json<AttachmentDTO>, LMSError> {
    ensure_staff(&claims)?;
    let attachment = state
        .attachment_service
        .complete_upload(claims.sub, claims.role, id)
        .await?;

    Ok(Json(attachment.into()))
}

/// Get a short-lived download link for a file.
#[utoipa::path(
    get,
    tag = "Attachment",
    path = "/{id}/download",
    params(
        ("id" = Uuid, Path)
    ),
    responses(
        (status = 200, body = AttachmentDownloadDTO, description = "Presigned download link"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no access to the file's lecture or task"),
        (status = 404, description = "File not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn download(
    claims: AccessTokenClaim,
    State(state): State<AttachmentState>,
    Path(id): Path<Uuid>,
) -> Result<Json<AttachmentDownloadDTO>, LMSError> {
    let url = state
        .attachment_service
        .download_url(claims.sub, claims.role, id)
        .await?;

    Ok(Json(AttachmentDownloadDTO {
        url,
        expires_in: DOWNLOAD_URL_TTL_SECS,
    }))
}

/// Delete a file, or cancel an upload that hasn't been completed.
#[utoipa::path(
    delete,
    tag = "Attachment",
    path = "/{id}",
    params(
        ("id" = Uuid, Path)
    ),
    responses(
        (status = 204, description = "File deleted"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "User has no permission to manage materials"),
        (status = 404, description = "File not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn delete(
    claims: AccessTokenClaim,
    State(state): State<AttachmentState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, LMSError> {
    ensure_staff(&claims)?;
    state
        .attachment_service
        .delete(claims.sub, claims.role, id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
