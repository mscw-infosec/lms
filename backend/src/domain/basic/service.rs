use chrono::Utc;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use super::{model::BasicUser, repository::BasicAuthRepository};
use crate::domain::account::model::UserRole;
use crate::domain::account::repository::PasswordResetCacheRepository;
use crate::{
    errors::{LMSError, Result},
    infrastructure::{crypto::Argon, email::EmailService},
    repo,
    utils::generate_random_string,
};

/// Lifetime of a password-reset link.
const RESET_TTL_SECS: u64 = 60 * 60;

#[derive(Clone)]
pub struct BasicAuthService {
    repo: repo!(BasicAuthRepository),
    reset_repo: repo!(PasswordResetCacheRepository),
    email: EmailService,
}

impl BasicAuthService {
    pub fn new(
        repo: repo!(BasicAuthRepository),
        reset_repo: repo!(PasswordResetCacheRepository),
        email: EmailService,
    ) -> Self {
        Self {
            repo,
            reset_repo,
            email,
        }
    }

    pub async fn register(
        &self,
        first_name: String,
        last_name: String,
        patronymic: Option<String>,
        email: String,
        password: String,
    ) -> Result<BasicUser> {
        let password_hash = Argon::hash_password(password.as_bytes())?;

        let username = crate::domain::account::model::UserModel::compose_username(
            &last_name,
            &first_name,
            patronymic.as_deref(),
        );

        if self.repo.is_exists(&username, &email).await? {
            return Err(LMSError::Conflict(
                "User with that email already exists.".to_string(),
            ));
        }

        let user = BasicUser {
            id: Uuid::new_v4(),
            username,
            email: email.clone(),
            role: UserRole::default(),
            first_name,
            last_name,
            patronymic,
            email_verified: false,
            password: password_hash,
            created_at: Utc::now(),
        };

        self.repo.create(&user).await?;
        Ok(user)
    }

    pub async fn login(&self, email: String, password: String) -> Result<BasicUser> {
        let Some(user) = self.repo.get_by_email(&email).await? else {
            return Err(LMSError::Forbidden("Wrong email or password.".to_string()));
        };

        if !Argon::verify(password.as_bytes(), &user.password)? {
            return Err(LMSError::Forbidden("Wrong email or password.".to_string()));
        }

        Ok(user)
    }

    pub async fn request_password_reset(&self, email: &str) -> Result<()> {
        let Some((user_id, user_email)) = self.repo.find_user_for_reset(email).await? else {
            info!(%email, "password reset requested for an unknown email - no email sent");
            return Ok(());
        };

        let token = generate_random_string(48);
        self.reset_repo
            .store_reset(&token, user_id, RESET_TTL_SECS)
            .await?;

        if let Err(err) = self.email.send_password_reset(&user_email, &token).await {
            error!(user.id = %user_id, %email, error = ?err, "failed to send password-reset email");
        }

        Ok(())
    }

    pub async fn reset_password(&self, token: &str, new_password: &str) -> Result<Uuid> {
        let user_id = self
            .reset_repo
            .take_reset(token)
            .await?
            .ok_or_else(|| LMSError::NotFound("Invalid or expired reset link.".to_string()))?;

        let password_hash = Argon::hash_password(new_password.as_bytes())?;
        self.repo.set_password(user_id, &password_hash).await?;

        Ok(user_id)
    }
}
