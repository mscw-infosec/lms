use crate::domain::task::service::CTFD_API_URL;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use s3::post_policy::PresignedPost;
use std::sync::Arc;
use uuid::Uuid;

use crate::domain::task::model::CtfdUsersReponse;
use crate::utils::send_and_parse;
use crate::{
    domain::account::{
        model::UserModel,
        repository::{AccountCacheRepository, AccountRepository},
    },
    errors::{LMSError, Result},
    infrastructure::s3::S3,
    repo,
};

#[derive(Clone)]
pub struct AccountService {
    db_repo: repo!(AccountRepository),
    cache_repo: repo!(AccountCacheRepository),
    s3: repo!(S3),
    pub redirect_url: String,
    http_client: reqwest::Client,
    ctfd_token: String,
}

impl AccountService {
    pub fn new(
        db_repo: repo!(AccountRepository),
        cache_repo: repo!(AccountCacheRepository),
        s3: repo!(S3),
        redirect_url: &str,
        http_client: reqwest::Client,
        ctfd_token: String,
    ) -> Self {
        Self {
            db_repo,
            cache_repo,
            s3,
            redirect_url: redirect_url.to_string(),
            http_client,
            ctfd_token,
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

    pub async fn get_ctfd(&self, email: String) -> Result<bool> {
        let existent_user = send_and_parse::<CtfdUsersReponse>(
            self.http_client
                .get(format!(
                    "{CTFD_API_URL}/users?view=admin&field=email&q={email}"
                ))
                .header(CONTENT_TYPE, "application/json")
                .header(AUTHORIZATION, format!("Token {}", self.ctfd_token)),
            "CTFd user checking",
        )
        .await?;

        if existent_user.meta.pagination.total != 0 {
            return Ok(true);
        }
        Ok(false)
    }
}
