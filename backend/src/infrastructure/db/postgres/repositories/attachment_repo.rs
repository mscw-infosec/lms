use crate::{
    domain::attachments::{
        model::{AttachmentModel, AttachmentOwner, NewAttachment},
        repository::AttachmentRepository,
    },
    errors::{LMSError, Result},
    infrastructure::db::postgres::RepositoryPostgres,
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[async_trait]
impl AttachmentRepository for RepositoryPostgres {
    async fn create(&self, attachment: NewAttachment) -> Result<AttachmentModel> {
        let created = sqlx::query_as!(
            AttachmentModel,
            r#"
                INSERT INTO attachments (id, lecture_id, task_id, file_name, content_type, size, s3_key, uploaded_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, lecture_id, task_id, file_name, content_type, size, s3_key, uploaded_by, created_at, uploaded_at
            "#,
            attachment.id,
            attachment.owner.lecture_id(),
            attachment.owner.task_id(),
            attachment.file_name,
            attachment.content_type,
            attachment.size,
            attachment.s3_key,
            attachment.uploaded_by
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(ref e) if e.is_foreign_key_violation() => {
                LMSError::NotFound("Lecture or task not found".to_string())
            }
            _ => err.into(),
        })?;

        Ok(created)
    }

    async fn get(&self, id: Uuid) -> Result<AttachmentModel> {
        let attachment = sqlx::query_as!(
            AttachmentModel,
            r#"
                SELECT id, lecture_id, task_id, file_name, content_type, size, s3_key, uploaded_by, created_at, uploaded_at
                FROM attachments
                WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| LMSError::NotFound("Attachment not found".to_string()))?;

        Ok(attachment)
    }

    async fn list(&self, owner: AttachmentOwner) -> Result<Vec<AttachmentModel>> {
        let attachments = match owner {
            AttachmentOwner::Lecture(lecture_id) => {
                sqlx::query_as!(
                    AttachmentModel,
                    r#"
                        SELECT id, lecture_id, task_id, file_name, content_type, size, s3_key, uploaded_by, created_at, uploaded_at
                        FROM attachments
                        WHERE lecture_id = $1 AND uploaded_at IS NOT NULL
                        ORDER BY created_at, id
                    "#,
                    lecture_id
                )
                .fetch_all(&self.pool)
                .await?
            }
            AttachmentOwner::Task(task_id) => {
                sqlx::query_as!(
                    AttachmentModel,
                    r#"
                        SELECT id, lecture_id, task_id, file_name, content_type, size, s3_key, uploaded_by, created_at, uploaded_at
                        FROM attachments
                        WHERE task_id = $1 AND uploaded_at IS NOT NULL
                        ORDER BY created_at, id
                    "#,
                    task_id
                )
                .fetch_all(&self.pool)
                .await?
            }
        };

        Ok(attachments)
    }

    async fn mark_uploaded(
        &self,
        id: Uuid,
        size: i64,
        content_type: &str,
    ) -> Result<AttachmentModel> {
        let attachment = sqlx::query_as!(
            AttachmentModel,
            r#"
                UPDATE attachments
                SET size = $2, content_type = $3, uploaded_at = COALESCE(uploaded_at, now())
                WHERE id = $1
                RETURNING id, lecture_id, task_id, file_name, content_type, size, s3_key, uploaded_by, created_at, uploaded_at
            "#,
            id,
            size,
            content_type
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| LMSError::NotFound("Attachment not found".to_string()))?;

        Ok(attachment)
    }

    async fn delete(&self, id: Uuid) -> Result<()> {
        let result = sqlx::query!(
            r#"
                DELETE FROM attachments
                WHERE id = $1
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(LMSError::NotFound("Attachment not found".to_string()));
        }

        Ok(())
    }

    async fn delete_stale_pending(&self, cutoff: DateTime<Utc>) -> Result<u64> {
        let result = sqlx::query!(
            r#"
                DELETE FROM attachments
                WHERE uploaded_at IS NULL AND created_at < $1
            "#,
            cutoff
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    async fn pending_object_deletions(&self, limit: i64) -> Result<Vec<String>> {
        let keys = sqlx::query_scalar!(
            r#"
                SELECT s3_key
                FROM s3_deletion_queue
                ORDER BY enqueued_at
                LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(keys)
    }

    async fn complete_object_deletion(&self, s3_key: &str) -> Result<()> {
        sqlx::query!(
            r#"
                DELETE FROM s3_deletion_queue
                WHERE s3_key = $1
            "#,
            s3_key
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
