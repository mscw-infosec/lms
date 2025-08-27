use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use super::{model::BasicUser, repository::BasicAuthRepository};
use crate::domain::account::model::UserRole;
use crate::{
    errors::{LMSError, Result},
    infrastructure::crypto::Argon,
    repo,
};

#[derive(Clone)]
pub struct BasicAuthService {
    repo: repo!(BasicAuthRepository),
}

impl BasicAuthService {
    pub const fn new(repo: repo!(BasicAuthRepository)) -> Self {
        Self { repo }
    }

    pub async fn register(
        &self,
        username: String,
        email: String,
        password: String,
    ) -> Result<BasicUser> {
        let password_hash = Argon::hash_password(password.as_bytes())?;

        if self.repo.is_exists(&username, &email).await? {
            return Err(LMSError::Conflict(
                "User with that email or username already exists.".to_string(),
            ));
        }

        let user = BasicUser {
            id: Uuid::new_v4(),
            username: username.clone(),
            email: email.clone(),
            role: UserRole::default(),
            password: password_hash,
            created_at: Utc::now(),
        };

        self.repo.create(&user).await?;
        Ok(user)
    }

    pub async fn login(&self, username: String, password: String) -> Result<BasicUser> {
        let Some(user) = self.repo.get_by_username(&username).await? else {
            return Err(LMSError::Forbidden(
                "Wrong username or password.".to_string(),
            ));
        };

        if !Argon::verify(password.as_bytes(), &user.password)? {
            return Err(LMSError::Forbidden(
                "Wrong username or password.".to_string(),
            ));
        }

        Ok(user)
    }
}
