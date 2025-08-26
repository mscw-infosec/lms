use std::sync::Arc;

use async_trait::async_trait;
use axum::http::header::{ACCEPT, AUTHORIZATION};
use base64::{Engine, prelude::BASE64_URL_SAFE_NO_PAD};
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use tower_cookies::Cookies;
use url::Url;
use uuid::Uuid;

use super::{
    model::{OAuth, OAuthUser},
    repository::OAuthRepository,
};
use crate::domain::task::model::{CtfdCreateUserResponse, CtfdUsersReponse};
use crate::domain::task::service::CTFD_API_URL;
use crate::utils::send_and_parse;
use crate::{errors::LMSError, infrastructure::s3::S3, repo, utils::generate_random_string};

#[derive(Deserialize, Debug)]
pub struct AccessTokenResponse {
    pub access_token: String,
    pub scope: Option<String>,
    pub token_type: String,
}

#[async_trait]
pub trait OAuthProvider {
    fn url(&self, state: String, code_challenge: String) -> Url;
    async fn get_user(&self, code: String, code_verifier: String) -> Result<OAuth, LMSError>;
}

#[derive(Clone)]
pub struct OAuthService {
    repo: repo!(OAuthRepository),
    s3: repo!(S3),
    http_client: reqwest::Client,
    ctfd_token: String,
}

impl OAuthService {
    pub const fn new(
        repo: repo!(OAuthRepository),
        s3: repo!(S3),
        http_client: reqwest::Client,
        ctfd_token: String,
    ) -> Self {
        Self {
            repo,
            s3,
            http_client,
            ctfd_token,
        }
    }

    pub async fn save_user(&self, oauth_user: OAuth) -> Result<Uuid, LMSError> {
        let user_id = self.repo.find_by_email(&oauth_user.email).await?;

        if let Some(user) = user_id {
            self.repo.add_provider(user, oauth_user).await?;
            return Ok(user);
        }

        let user: OAuthUser = oauth_user.into();
        let user_id = user.id;
        let avatar_url = user.avatar_url.clone();

        self.repo.create_user_with_provider(&user).await?;

        self.get_or_create_ctfd_account(user_id, user.username, user.email)
            .await?;

        self.s3
            .save_from_url(&format!("avatars/{user_id}"), &avatar_url)
            .await?;

        Ok(user_id)
    }

    pub fn generate() -> (String, String, String) {
        let state_str = generate_random_string(32);
        let code_verifier = generate_random_string(64);

        let code_challenge = {
            let hash = Sha256::digest(&code_verifier);
            BASE64_URL_SAFE_NO_PAD.encode(hash)
        };

        (state_str, code_verifier, code_challenge)
    }

    pub fn parse_cookies(cookies: &Cookies) -> Result<(String, String), LMSError> {
        let state = cookies
            .get("oauth_state")
            .map(|x| x.value().to_string())
            .ok_or(LMSError::Forbidden(
                "No `oauth_state` cookie was found".to_string(),
            ))?;

        let code_verifier = cookies
            .get("code_verifier")
            .map(|x| x.value().to_string())
            .ok_or(LMSError::Forbidden(
                "No `code_verifier` cookie was found".to_string(),
            ))?;

        Ok((state, code_verifier))
    }

    pub async fn get_or_create_ctfd_account(
        &self,
        user_id: Uuid,
        username: String,
        email: String,
    ) -> crate::errors::Result<i32> {
        let mut ctfd_username = username.clone();

        let existent_user = send_and_parse::<CtfdUsersReponse>(
            self.http_client
                .get(format!(
                    "{CTFD_API_URL}/users?view=admin&field=email&q={email}"
                ))
                .header(ACCEPT, "application/json")
                .header(AUTHORIZATION, format!("Token {}", self.ctfd_token)),
            "CTFd user checking",
        )
        .await?;

        if existent_user.meta.pagination.total != 0 {
            self.repo
                .update_ctfd_account(user_id, existent_user.data[0].id)
                .await?;
            return Ok(existent_user.data[0].id);
        }

        let user_with_same_name = send_and_parse::<CtfdUsersReponse>(
            self.http_client
                .get(format!(
                    "{CTFD_API_URL}/users?view=admin&field=name&q={username}"
                ))
                .header(ACCEPT, "application/json")
                .header(AUTHORIZATION, format!("Token {}", self.ctfd_token)),
            "CTFd user name checking",
        )
        .await?;

        if user_with_same_name.meta.pagination.total != 0 {
            ctfd_username = username + "_" + generate_random_string(6).as_str();
        }

        let created_user = send_and_parse::<CtfdCreateUserResponse>(
            self.http_client
                .post(format!("{CTFD_API_URL}/users?notify=true"))
                .json(&json!({
                    "name": ctfd_username,
                    "email": email,
                    "password": generate_random_string(16),
                    "verified": "false",
                    "hidden": "false",
                    "banned": "false",
                    "fields": Vec::<String>::new(),
                }))
                .header(AUTHORIZATION, format!("Token {}", self.ctfd_token)),
            "CTFd user creating",
        )
        .await?;

        if !created_user.success {
            return Err(LMSError::ServerError(
                "Could not create CTFd account.".to_string(),
            ));
        }

        let ctfd_id = created_user
            .data
            .expect("Could not unwrap successful CTFd account data")
            .id;
        self.repo.update_ctfd_account(user_id, ctfd_id).await?;

        Ok(ctfd_id)
    }
}
