use crate::domain::account::model::Attributes;
use crate::domain::task::service::{CTFD_API_URL, SIRIUS_API_URL};
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use s3::post_policy::PresignedPost;
use std::sync::Arc;
use uuid::Uuid;

use crate::domain::task::model::{CtfdUsersReponse, SiriusUserRequest, SiriusUserResponse};
use crate::utils::send_and_parse;
use crate::{
    domain::account::{
        model::{UserModel, UserRole},
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
    sirius_token: String
}

impl AccountService {
    pub fn new(
        db_repo: repo!(AccountRepository),
        cache_repo: repo!(AccountCacheRepository),
        s3: repo!(S3),
        redirect_url: &str,
        http_client: reqwest::Client,
        ctfd_token: String,
        sirius_token: String
    ) -> Self {
        Self {
            db_repo,
            cache_repo,
            s3,
            redirect_url: redirect_url.to_string(),
            http_client,
            ctfd_token,
            sirius_token
        }
    }

    pub async fn assign_predefined_attributes(&self, id: Uuid, email: String) -> Result<()> {
        let mut attrs = self
            .db_repo
            .get_user_predefined_attributes(email.clone())
            .await?;

        if !self.has_sirius_account(id).await? {
            let account = self.get_sirius(email.clone()).await;
            if let Ok(account) = account {
                self.db_repo.set_sirius_account(id, account).await?;
                attrs.insert("mosh_2026".to_string(), "true".to_string());
            }
        }

        if !attrs.is_empty() {
            self.upsert_attributes(id, attrs).await?;
            self.db_repo.delete_user_predefined_attribute(email).await?;
        }
        Ok(())
    }

    pub async fn has_sirius_account(&self, id: Uuid) -> Result<bool> {
        self.db_repo.has_sirius_account(id).await
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

    pub async fn get_sirius(&self, email: String) -> Result<i32> {
        let existent_user = send_and_parse::<SiriusUserResponse>(
            self.http_client
                .post(format!(
                    "{SIRIUS_API_URL}activities/olymp:mosh-secr-2026/applications:lookup"
                ))
                .header(CONTENT_TYPE, "application/json")
                .header(AUTHORIZATION, format!("Bearer {}", self.sirius_token))
                .json(&SiriusUserRequest {
                    email
                }),
            "Sirius user checking",
        )
            .await?;

        if existent_user.result.is_empty() {
            return Err(LMSError::NotFound("No such registration".to_string()));
        }
        Ok(str::parse::<i32>(existent_user.result[0].id.as_str()).expect("Somewhy Sirius has violated the spec"))
    }

    pub async fn list_accounts(&self, limit: i32, offset: i32) -> Result<Vec<UserModel>> {
        self.db_repo.list_users(limit, offset).await
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
