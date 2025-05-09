use async_trait::async_trait;
use uuid::Uuid;

use crate::errors::LMSError;

use super::model::{OAuth, OAuthUser};

#[async_trait]
pub trait OAuthRepository {
    async fn find_by_email(&self, email: &str) -> Result<Option<Uuid>, LMSError>;
    async fn create_user_with_provider(&self, user: OAuthUser) -> Result<(), LMSError>;
    async fn add_provider(&self, user_id: Uuid, provider: OAuth) -> Result<(), LMSError>;
}
