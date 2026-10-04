use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::domain::attachments::model::{AttachmentModel, UploadIntent};

/// Additional material attached to a lecture or a task.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct AttachmentDTO {
    pub id: Uuid,
    pub file_name: String,
    pub content_type: String,
    /// Size in bytes.
    pub size: i64,
    pub created_at: DateTime<Utc>,
}

impl From<AttachmentModel> for AttachmentDTO {
    fn from(value: AttachmentModel) -> Self {
        Self {
            id: value.id,
            file_name: value.file_name,
            content_type: value.content_type,
            size: value.size,
            created_at: value.created_at,
        }
    }
}

/// Announces a file the client is about to upload.
#[derive(Deserialize, Serialize, Validate, ToSchema)]
pub struct RequestAttachmentUploadDTO {
    #[validate(length(
        min = 1,
        max = 1024,
        message = "File name must be between 1 and 1024 characters"
    ))]
    pub file_name: String,

    /// MIME type of the file; falls back to `application/octet-stream`.
    pub content_type: Option<String>,

    /// Size in bytes.
    #[validate(range(min = 1, message = "File is empty"))]
    pub size: i64,
}

impl From<RequestAttachmentUploadDTO> for UploadIntent {
    fn from(value: RequestAttachmentUploadDTO) -> Self {
        Self {
            file_name: value.file_name,
            content_type: value.content_type,
            size: value.size,
        }
    }
}

/// Presigned POST for uploading the file straight to storage.
///
/// Send `multipart/form-data` to `url` with every entry of `fields` (unchanged,
/// as form fields) followed by the file itself as the `file` field, then call
/// `POST /attachments/{attachment_id}/complete`.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct AttachmentUploadDTO {
    pub attachment_id: Uuid,
    pub url: String,
    pub fields: HashMap<String, String>,
    /// Seconds until the upload must have started.
    pub expires_in: u32,
}

/// Short-lived link that downloads the file under its original name.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct AttachmentDownloadDTO {
    pub url: String,
    /// Seconds until `url` stops working.
    pub expires_in: u32,
}
