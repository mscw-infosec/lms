use crate::domain::attachments::model::{AttachmentModel, AttachmentOwner, NewAttachment};
use crate::errors::Result;
use crate::gen_openapi::DummyRepository;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use impl_unimplemented::impl_unimplemented;
use uuid::Uuid;

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait AttachmentRepository {
    /// Inserts a pending attachment.
    async fn create(&self, attachment: NewAttachment) -> Result<AttachmentModel>;
    async fn get(&self, id: Uuid) -> Result<AttachmentModel>;
    /// Uploaded (non-pending) attachments of the owner.
    async fn list(&self, owner: AttachmentOwner) -> Result<Vec<AttachmentModel>>;
    async fn mark_uploaded(
        &self,
        id: Uuid,
        size: i64,
        content_type: &str,
    ) -> Result<AttachmentModel>;
    /// Deletes the row; a DB trigger queues its S3 object for removal.
    async fn delete(&self, id: Uuid) -> Result<()>;
    /// Drops uploads that were started before `cutoff` and never confirmed.
    async fn delete_stale_pending(&self, cutoff: DateTime<Utc>) -> Result<u64>;
    /// Oldest S3 keys waiting to be removed from the bucket.
    async fn pending_object_deletions(&self, limit: i64) -> Result<Vec<String>>;
    async fn complete_object_deletion(&self, s3_key: &str) -> Result<()>;
}
