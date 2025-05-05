use chrono::Utc;
use uuid::Uuid;

use super::{model::User, repository::BasicAuthRepository};
use crate::{
    errors::{LMSError, Result},
    infrastructure::crypto::Argon,
};

pub struct BasicAuthService {
    repo: Box<dyn BasicAuthRepository + Send + Sync>,
}

impl BasicAuthService {
    pub const fn new(repo: Box<dyn BasicAuthRepository + Send + Sync>) -> Self {
        Self { repo }
    }

    pub async fn register(
        &self,
        username: String,
        email: String,
        password: String,
    ) -> Result<User> {
        let password_hash = Argon::hash_password(password.as_bytes())?;

        if self.repo.is_exists(&username, &email).await? {
            return Err(LMSError::Conflict(
                "User with that email or username already exists.".to_string(),
            ));
        }

        let user = User {
            id: Uuid::new_v4(),
            username,
            email,
            password: password_hash,
            created_at: Utc::now(),
        };

        self.repo.create(&user).await?;

        Ok(user)
    }

    pub async fn login(&self, username: String, password: String) -> Result<User> {
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
