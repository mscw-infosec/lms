use std::sync::Arc;

use async_trait::async_trait;
use base64::{prelude::BASE64_URL_SAFE_NO_PAD, Engine};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tower_cookies::Cookies;
use url::Url;
use uuid::Uuid;

use crate::{errors::LMSError, infrastructure::s3::S3Manager, repo, utils::generate_random_string};

use super::{
    model::{OAuth, OAuthUser},
    repository::OAuthRepository,
};

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
    s3: S3Manager,
}

impl OAuthService {
    pub const fn new(repo: repo!(OAuthRepository), s3: S3Manager) -> Self {
        Self { repo, s3 }
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

        self.repo.create_user_with_provider(user).await?;

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
}
