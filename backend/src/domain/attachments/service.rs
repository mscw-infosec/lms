use crate::domain::account::model::UserRole;
use crate::domain::attachments::model::{
    AttachmentModel, AttachmentOwner, NewAttachment, UploadIntent,
};
use crate::domain::attachments::repository::AttachmentRepository;
use crate::domain::exam::service::ExamService;
use crate::domain::lectures::service::LectureService;
use crate::domain::practice::service::PracticeService;
use crate::domain::task::service::TaskService;
use crate::errors::{LMSError, Result};
use crate::infrastructure::s3::S3;
use crate::repo;
use chrono::{TimeDelta, Utc};
use s3::post_policy::PresignedPost;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};
use uuid::Uuid;

/// How long a download link stays valid.
pub const DOWNLOAD_URL_TTL_SECS: u32 = 5 * 60;
/// How long the browser may take to start an upload with its presigned POST.
pub const UPLOAD_URL_TTL_SECS: u32 = 60 * 60;
/// Pending uploads older than this are treated as abandoned. Comfortably longer
/// than `UPLOAD_URL_TTL_SECS` so an upload in flight is never cut off.
const STALE_UPLOAD_AFTER: TimeDelta = TimeDelta::days(1);

const MAX_FILE_NAME_CHARS: usize = 255;
const DEFAULT_CONTENT_TYPE: &str = "application/octet-stream";
const DELETION_BATCH: u16 = 100;

#[derive(Clone)]
pub struct AttachmentService {
    repo: repo!(AttachmentRepository),
    s3: repo!(S3),
    lecture_service: LectureService,
    task_service: TaskService,
    practice_service: PracticeService,
    exam_service: ExamService,
    max_size: usize,
}

impl AttachmentService {
    pub fn new(
        repo: repo!(AttachmentRepository),
        s3: repo!(S3),
        lecture_service: LectureService,
        task_service: TaskService,
        practice_service: PracticeService,
        exam_service: ExamService,
        max_size: usize,
    ) -> Self {
        Self {
            repo,
            s3,
            lecture_service,
            task_service,
            practice_service,
            exam_service,
            max_size,
        }
    }

    /// Largest accepted file, in bytes.
    pub const fn max_size(&self) -> usize {
        self.max_size
    }

    /// Ensures the caller may see the lecture or task the files belong to.
    ///
    /// Staff may touch any existing lecture/task. A student may see a task's
    /// files when the task is offered as practice in a topic they can access,
    /// or when they may currently view the entities of an exam containing it
    /// (active attempt or published results) - the same rule as the exam itself.
    async fn ensure_owner_access(
        &self,
        user: Uuid,
        role: UserRole,
        owner: AttachmentOwner,
    ) -> Result<()> {
        match owner {
            AttachmentOwner::Lecture(id) => {
                self.lecture_service.ensure_access(user, role, id).await
            }
            AttachmentOwner::Task(id) => {
                if matches!(role, UserRole::Admin | UserRole::Teacher) {
                    let _ = self.task_service.get_task(id).await?;
                    return Ok(());
                }

                if self
                    .practice_service
                    .is_task_accessible(user, role, id)
                    .await?
                {
                    return Ok(());
                }

                for exam in self.task_service.get_exams(id).await? {
                    if self
                        .exam_service
                        .can_view_entities(exam.id, user, role)
                        .await?
                    {
                        return Ok(());
                    }
                }

                Err(LMSError::Forbidden(
                    "You do not have access to this task's materials".to_string(),
                ))
            }
        }
    }

    async fn get_with_access(
        &self,
        user: Uuid,
        role: UserRole,
        id: Uuid,
    ) -> Result<AttachmentModel> {
        let attachment = self.repo.get(id).await?;
        let owner = attachment
            .owner()
            .ok_or_else(|| LMSError::ServerError("Attachment has no owner".to_string()))?;
        self.ensure_owner_access(user, role, owner).await?;
        Ok(attachment)
    }

    pub async fn list(
        &self,
        user: Uuid,
        role: UserRole,
        owner: AttachmentOwner,
    ) -> Result<Vec<AttachmentModel>> {
        self.ensure_owner_access(user, role, owner).await?;
        self.repo.list(owner).await
    }

    /// Registers a pending attachment and returns a presigned POST the browser
    /// uploads the file with, straight to S3. The policy pins the key, the
    /// content type and the size limit, so S3 rejects anything else.
    pub async fn start_upload(
        &self,
        user: Uuid,
        role: UserRole,
        owner: AttachmentOwner,
        intent: UploadIntent,
    ) -> Result<(AttachmentModel, PresignedPost)> {
        self.ensure_owner_access(user, role, owner).await?;

        if intent.size <= 0 {
            return Err(LMSError::ShitHappened("File is empty".to_string()));
        }
        if usize::try_from(intent.size).map_or(true, |size| size > self.max_size) {
            return Err(LMSError::PayloadTooLarge(self.size_limit_message()));
        }

        let id = Uuid::new_v4();
        // The key never contains the user-supplied name: it is served back via
        // Content-Disposition instead, so odd names can't break the path.
        let s3_key = format!("{}/{id}", owner.key_prefix());
        let content_type = sanitize_content_type(intent.content_type.as_deref());

        let presigned = self
            .s3
            .presign_upload(
                &s3_key,
                &content_type,
                u32::try_from(self.max_size).unwrap_or(u32::MAX),
                UPLOAD_URL_TTL_SECS,
            )
            .await?;

        let attachment = self
            .repo
            .create(NewAttachment {
                id,
                owner,
                file_name: sanitize_file_name(&intent.file_name),
                content_type,
                size: intent.size,
                s3_key,
                uploaded_by: user,
            })
            .await?;

        Ok((attachment, presigned))
    }

    /// Confirms that the browser finished uploading: the object must be in S3.
    /// Idempotent, so a retried request after success is harmless.
    pub async fn complete_upload(
        &self,
        user: Uuid,
        role: UserRole,
        id: Uuid,
    ) -> Result<AttachmentModel> {
        let attachment = self.get_with_access(user, role, id).await?;
        if attachment.is_uploaded() {
            return Ok(attachment);
        }

        let Some(size) = self.s3.object_size(&attachment.s3_key).await? else {
            return Err(LMSError::Conflict(
                "File has not been uploaded to storage yet".to_string(),
            ));
        };

        // S3 already enforces the policy; this guards against a misbehaving store
        if size <= 0 || usize::try_from(size).map_or(true, |size| size > self.max_size) {
            self.repo.delete(id).await?;
            return Err(LMSError::PayloadTooLarge(self.size_limit_message()));
        }

        self.repo
            .mark_uploaded(id, size, &attachment.content_type)
            .await
    }

    /// Short-lived link that downloads the file under its original name.
    pub async fn download_url(&self, user: Uuid, role: UserRole, id: Uuid) -> Result<String> {
        let attachment = self.get_with_access(user, role, id).await?;
        if !attachment.is_uploaded() {
            return Err(LMSError::NotFound("Attachment not found".to_string()));
        }
        self.s3
            .presign_get(
                &attachment.s3_key,
                DOWNLOAD_URL_TTL_SECS,
                Some(&attachment.file_name),
            )
            .await
    }

    /// Deletes an attachment, or cancels an upload that is still pending.
    pub async fn delete(&self, user: Uuid, role: UserRole, id: Uuid) -> Result<()> {
        let attachment = self.get_with_access(user, role, id).await?;
        self.repo.delete(id).await?;

        // Best-effort immediate cleanup; the queue retries on failure.
        match self.s3.delete_object(&attachment.s3_key).await {
            Ok(()) => {
                self.repo
                    .complete_object_deletion(&attachment.s3_key)
                    .await?;
            }
            Err(e) => warn!(
                "Deferred removal of attachment object `{}`: {e:?}",
                attachment.s3_key
            ),
        }

        Ok(())
    }

    /// Removes S3 objects of attachments whose rows were deleted, including
    /// ones that went away through cascades (lecture, task, practice, topic,
    /// course deletion). Returns how many objects were removed.
    pub async fn purge_deleted_objects(&self) -> Result<usize> {
        let mut purged = 0;
        loop {
            let keys = self
                .repo
                .pending_object_deletions(i64::from(DELETION_BATCH))
                .await?;
            let batch_len = keys.len();
            let mut progressed = false;

            for key in keys {
                match self.s3.delete_object(&key).await {
                    Ok(()) => {
                        self.repo.complete_object_deletion(&key).await?;
                        purged += 1;
                        progressed = true;
                    }
                    Err(e) => warn!("Failed to remove attachment object `{key}`: {e:?}"),
                }
            }

            // stop on a short batch, or when S3 keeps failing to avoid spinning
            if !progressed || batch_len < usize::from(DELETION_BATCH) {
                return Ok(purged);
            }
        }
    }

    /// Periodically drops abandoned uploads and drains the S3 deletion queue
    /// in the background.
    pub fn spawn_object_cleanup(&self, every: Duration) {
        let service = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(every);
            loop {
                interval.tick().await;
                let cutoff = Utc::now() - STALE_UPLOAD_AFTER;
                match service.repo.delete_stale_pending(cutoff).await {
                    Ok(0) => {}
                    Ok(n) => info!("Dropped {n} abandoned attachment upload(s)"),
                    Err(e) => error!("Failed to drop abandoned attachment uploads: {e:?}"),
                }
                match service.purge_deleted_objects().await {
                    Ok(0) => {}
                    Ok(n) => info!("Removed {n} deleted attachment object(s) from S3"),
                    Err(e) => error!("Attachment object cleanup failed: {e:?}"),
                }
            }
        });
    }

    pub fn size_limit_message(&self) -> String {
        format!(
            "File is too large: the limit is {} MB",
            self.max_size / (1024 * 1024)
        )
    }
}

/// Keeps only the base name (browsers may send a full path), drops control
/// characters and caps the length.
fn sanitize_file_name(raw: &str) -> String {
    let base = raw.rsplit(['/', '\\']).next().unwrap_or_default();
    let cleaned: String = base
        .chars()
        .filter(|c| !c.is_control())
        .take(MAX_FILE_NAME_CHARS)
        .collect();
    let cleaned = cleaned.trim();

    if cleaned.is_empty() || cleaned == "." || cleaned == ".." {
        "file".to_string()
    } else {
        cleaned.to_string()
    }
}

fn sanitize_content_type(raw: Option<&str>) -> String {
    raw.map(str::trim)
        .filter(|ct| {
            ct.len() <= 255
                && ct
                    .split_once('/')
                    .is_some_and(|(t, s)| !t.is_empty() && !s.is_empty())
                && ct.chars().all(|c| c.is_ascii_graphic() || c == ' ')
        })
        .map_or_else(|| DEFAULT_CONTENT_TYPE.to_string(), str::to_lowercase)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_name_strips_paths_and_controls() {
        assert_eq!(sanitize_file_name("C:\\fakepath\\lab 1.pdf"), "lab 1.pdf");
        assert_eq!(sanitize_file_name("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_file_name("лекция\n№1.pptx"), "лекция№1.pptx");
        assert_eq!(sanitize_file_name(".."), "file");
        assert_eq!(sanitize_file_name("   "), "file");
        assert_eq!(sanitize_file_name(&"a".repeat(300)).chars().count(), 255);
    }

    #[test]
    fn content_type_falls_back_to_octet_stream() {
        assert_eq!(
            sanitize_content_type(Some("application/PDF")),
            "application/pdf"
        );
        assert_eq!(sanitize_content_type(Some("garbage")), DEFAULT_CONTENT_TYPE);
        assert_eq!(
            sanitize_content_type(Some("text/\nhtml")),
            DEFAULT_CONTENT_TYPE
        );
        assert_eq!(sanitize_content_type(None), DEFAULT_CONTENT_TYPE);
    }
}
