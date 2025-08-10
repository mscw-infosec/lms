use s3::post_policy::PresignedPost;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    domain::account::{
        model::UserModel,
        repository::{AccountCacheRepository, AccountRepository},
    },
    errors::{LMSError, Result},
    infrastructure::s3::S3Manager,
    repo,
};

#[derive(Clone)]
pub struct AccountService {
    db_repo: repo!(AccountRepository),
    cache_repo: repo!(AccountCacheRepository),
    s3: S3Manager,
    pub redirect_url: String
}

impl AccountService {
    pub fn new(
        db_repo: repo!(AccountRepository),
        cache_repo: repo!(AccountCacheRepository),
        s3: S3Manager,
        redirect_url: &str
    ) -> Self {
        Self {
            db_repo,
            cache_repo,
            s3,
            redirect_url: redirect_url.to_string(),
        }
    }

    pub async fn get_user(&self, id: Uuid) -> Result<UserModel> {
        if let Some(user) = self.cache_repo.get_user_by_id(id).await? {
            return Ok(user);
        }

        let user = self
            .db_repo
            .get_user_by_id(id)
            .await?
            .ok_or_else(|| LMSError::NotFound("No user was found with that id.".to_string()))?;

        self.cache_repo.store_user(&user).await?;

        Ok(user)
    }

    pub async fn presigned_url(&self, id: Uuid) -> Result<PresignedPost> {
        let path = format!("avatars/{id}");
        let presigned = self.s3.presign_post(&path).await?;

        Ok(presigned)
    }
}
