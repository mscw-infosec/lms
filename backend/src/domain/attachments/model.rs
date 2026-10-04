use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

/// A file (additional material) attached to a lecture or a task.
///
/// Exactly one of `lecture_id` / `task_id` is set. Rows start pending
/// (`uploaded_at` empty) while the browser uploads to S3.
#[derive(FromRow, Serialize, Deserialize, Debug, Clone)]
pub struct AttachmentModel {
    pub id: Uuid,
    pub lecture_id: Option<i32>,
    pub task_id: Option<i32>,
    pub file_name: String,
    pub content_type: String,
    pub size: i64,
    pub s3_key: String,
    pub uploaded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub uploaded_at: Option<DateTime<Utc>>,
}

impl AttachmentModel {
    pub const fn is_uploaded(&self) -> bool {
        self.uploaded_at.is_some()
    }

    pub const fn owner(&self) -> Option<AttachmentOwner> {
        match (self.lecture_id, self.task_id) {
            (Some(id), None) => Some(AttachmentOwner::Lecture(id)),
            (None, Some(id)) => Some(AttachmentOwner::Task(id)),
            _ => None,
        }
    }
}

/// Bucket prefix holding every attachment. It shares the bucket with public
/// prefixes (avatars), so the bucket policy must never grant anonymous reads here.
pub const ATTACHMENTS_KEY_PREFIX: &str = "attachments";

/// What an attachment hangs off. Tasks cover both exam and practice tasks.
#[derive(Clone, Copy, Debug)]
pub enum AttachmentOwner {
    Lecture(i32),
    Task(i32),
}

impl AttachmentOwner {
    pub const fn lecture_id(self) -> Option<i32> {
        match self {
            Self::Lecture(id) => Some(id),
            Self::Task(_) => None,
        }
    }

    pub const fn task_id(self) -> Option<i32> {
        match self {
            Self::Task(id) => Some(id),
            Self::Lecture(_) => None,
        }
    }

    /// S3 key prefix grouping all files of one owner.
    pub fn key_prefix(self) -> String {
        match self {
            Self::Lecture(id) => format!("{ATTACHMENTS_KEY_PREFIX}/lecture/{id}"),
            Self::Task(id) => format!("{ATTACHMENTS_KEY_PREFIX}/task/{id}"),
        }
    }
}

/// What the client announces before uploading a file.
pub struct UploadIntent {
    pub file_name: String,
    pub content_type: Option<String>,
    pub size: i64,
}

/// Pending row inserted before the browser uploads the object.
pub struct NewAttachment {
    pub id: Uuid,
    pub owner: AttachmentOwner,
    pub file_name: String,
    pub content_type: String,
    pub size: i64,
    pub s3_key: String,
    pub uploaded_by: Uuid,
}
