use chrono::{Duration, Utc};
use uuid::Uuid;

use crate::{
    domain::refresh_token::{
        model::{RefreshTokenData, SessionInfo},
        repository::RefreshTokenRepository,
    },
    errors::{LMSError, Result},
    infrastructure::jwt::{JWT, RefreshTokenClaim},
};

pub struct RefreshTokenService {
    repo: Box<dyn RefreshTokenRepository + Send + Sync>,
    jwt: JWT,
}

impl RefreshTokenService {
    pub fn new(repo: Box<dyn RefreshTokenRepository + Send + Sync>, jwt: JWT) -> Self {
        Self { repo, jwt }
    }

    pub async fn create_refresh_token(&self, user_id: Uuid) -> Result<(String, Uuid)> {
        let jti = Uuid::new_v4();
        let now = Utc::now();
        let expires_at = now + Duration::days(30);

        let token_data = RefreshTokenData {
            user_id,
            // TODO: collect something to display later
            device_id: "default".to_string(),
            issued_at: now,
            last_used: now,
            expires_at,
            rotated: false,
        };

        self.repo.store_token(jti, token_data).await?;
        self.repo.add_to_user_sessions(user_id, jti).await?;

        let token = self.jwt.generate_refresh_token(user_id, jti)?;
        Ok((token, jti))
    }

    pub async fn validate_and_rotate(&self, token: &RefreshTokenClaim) -> Result<(String, Uuid)> {
        let token_data = self
            .repo
            .get_token(token.jti)
            .await?
            .ok_or_else(|| LMSError::Unauthorized("Invalid refresh token".to_string()))?;

        if token_data.rotated {
            return Err(LMSError::Unauthorized(
                "Token has already been used".to_string(),
            ));
        }

        if token_data.expires_at < Utc::now() {
            return Err(LMSError::Unauthorized("Token has expired".to_string()));
        }

        self.repo.mark_as_rotated(token.jti).await?;

        let (new_token, new_jti) = self.create_refresh_token(token.sub).await?;
        Ok((new_token, new_jti))
    }

    pub async fn get_user_sessions(&self, user_id: Uuid) -> Result<Vec<SessionInfo>> {
        self.repo.get_user_sessions(user_id).await
    }

    pub async fn logout_session(&self, user_id: Uuid, jti: Uuid) -> Result<()> {
        self.repo.delete_token(jti).await?;
        self.repo.remove_from_user_sessions(user_id, jti).await?;
        Ok(())
    }

    pub async fn logout_all_sessions(&self, user_id: Uuid) -> Result<()> {
        self.repo.delete_all_user_sessions(user_id).await?;
        Ok(())
    }
}
