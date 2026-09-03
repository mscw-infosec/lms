use crate::domain::account::model::Attributes;
use crate::domain::task::service::CTFD_API_URL;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use s3::post_policy::PresignedPost;
use std::sync::Arc;
use uuid::Uuid;

use crate::domain::task::model::CtfdUsersReponse;
use crate::utils::send_and_parse;
use crate::{
    domain::account::{
        model::{UserModel, UserRole},
        repository::{AccountCacheRepository, AccountRepository, EmailVerificationCacheRepository},
    },
    errors::{LMSError, Result},
    infrastructure::{email::EmailService, s3::S3},
    repo,
    utils::generate_random_string,
};

/// Lifetime of an email-verification link.
const VERIFICATION_TTL_SECS: u64 = 24 * 60 * 60;

#[derive(Clone)]
pub struct AccountService {
    db_repo: repo!(AccountRepository),
    cache_repo: repo!(AccountCacheRepository),
    verification_repo: repo!(EmailVerificationCacheRepository),
    email: EmailService,
    s3: repo!(S3),
    pub redirect_url: String,
    http_client: reqwest::Client,
    ctfd_token: String,
}

impl AccountService {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        db_repo: repo!(AccountRepository),
        cache_repo: repo!(AccountCacheRepository),
        verification_repo: repo!(EmailVerificationCacheRepository),
        email: EmailService,
        s3: repo!(S3),
        redirect_url: &str,
        http_client: reqwest::Client,
        ctfd_token: String,
    ) -> Self {
        Self {
            db_repo,
            cache_repo,
            verification_repo,
            email,
            s3,
            redirect_url: redirect_url.to_string(),
            http_client,
            ctfd_token,
        }
    }

    /// Generate a fresh email-verification token, persist it, and email the
    /// verification link to the user.
    pub async fn send_verification_email(&self, user_id: Uuid, email: &str) -> Result<()> {
        let token = generate_random_string(48);
        self.verification_repo
            .store_verification(&token, user_id, VERIFICATION_TTL_SECS)
            .await?;
        self.email.send_verification(email, &token).await?;
        Ok(())
    }

    /// Re-send a verification email to the given user, unless already verified.
    pub async fn resend_verification(&self, user_id: Uuid) -> Result<()> {
        let user = self.get_user(user_id).await?;
        if user.email_verified {
            return Err(LMSError::Conflict("Email is already verified.".to_string()));
        }
        self.send_verification_email(user_id, &user.email).await
    }

    /// Consume a verification token and mark the associated user's email as
    /// verified. Returns the verified user id.
    pub async fn verify_email(&self, token: &str) -> Result<Uuid> {
        let user_id = self
            .verification_repo
            .take_verification(token)
            .await?
            .ok_or_else(|| {
                LMSError::NotFound("Invalid or expired verification link.".to_string())
            })?;

        self.db_repo.set_email_verified(user_id).await?;
        self.cache_repo.invalidate_user(user_id).await?;

        Ok(user_id)
    }

    pub async fn mark_email_verified(&self, user_id: Uuid) -> Result<()> {
        self.db_repo.set_email_verified(user_id).await?;
        self.cache_repo.invalidate_user(user_id).await?;
        Ok(())
    }

    /// Update the user's names (used both for profile edits and for OAuth users
    /// completing their required details). Recomposes the display `username`.
    pub async fn update_profile(
        &self,
        user_id: Uuid,
        first_name: &str,
        last_name: &str,
        patronymic: Option<&str>,
    ) -> Result<UserModel> {
        let username = UserModel::compose_username(last_name, first_name, patronymic);
        self.db_repo
            .update_profile(user_id, first_name, last_name, patronymic, &username)
            .await?;
        self.cache_repo.invalidate_user(user_id).await?;
        self.get_user(user_id).await
    }

    pub async fn assign_predefined_attributes(&self, id: Uuid, email: String) -> Result<()> {
        let attrs = self
            .db_repo
            .get_user_predefined_attributes(email.clone())
            .await?;
        if !attrs.is_empty() {
            self.upsert_attributes(id, attrs).await?;
            self.db_repo.delete_user_predefined_attribute(email).await?;
        }
        Ok(())
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

    pub async fn get_user_by_email(&self, email: String) -> Result<UserModel> {
        let user = self
            .db_repo
            .get_user_by_email(email)
            .await?
            .ok_or_else(|| LMSError::NotFound("No user was found with that id.".to_string()))?;

        self.cache_repo.store_user(&user).await?;

        Ok(user)
    }

    pub async fn get_user_active_ctfd_tasks(&self, user_id: Uuid) -> Result<Vec<usize>> {
        self.db_repo.get_user_active_ctfd_tasks(user_id).await
    }

    pub async fn upsert_attributes(&self, id: Uuid, attrs: Attributes) -> Result<Attributes> {
        let attributes = self.db_repo.upsert_attributes(id, attrs).await?;
        self.cache_repo
            .update_attributes(id, attributes.clone())
            .await?;

        Ok(attributes)
    }

    pub async fn delete_attribute(&self, id: Uuid, key: &str) -> Result<()> {
        let mut attributes = self.get_user(id).await?.attributes;
        if attributes.remove(key).is_none() {
            return Err(LMSError::NotFound(format!(
                "No attribute found with key: {key}"
            )));
        }

        let attributes = self.db_repo.upsert_attributes(id, attributes).await?;
        self.cache_repo.update_attributes(id, attributes).await?;

        Ok(())
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

    pub async fn list_accounts(
        &self,
        limit: i32,
        offset: i32,
        search: Option<String>,
    ) -> Result<(Vec<UserModel>, i64)> {
        // Treat blank search as "no filter".
        let search = search.filter(|s| !s.trim().is_empty());
        let users = self
            .db_repo
            .list_users(limit, offset, search.clone())
            .await?;
        let total = self.db_repo.count_users(search).await?;
        Ok((users, total))
    }

    pub async fn set_user_role(&self, id: Uuid, role: UserRole) -> Result<UserModel> {
        self.db_repo.update_user_role(id, role).await?;
        // Fetch from DB to get fresh data and then refresh cache
        let user = self
            .db_repo
            .get_user_by_id(id)
            .await?
            .ok_or_else(|| LMSError::NotFound("No user was found with that id.".to_string()))?;
        self.cache_repo.store_user(&user).await?;
        Ok(user)
    }
}
