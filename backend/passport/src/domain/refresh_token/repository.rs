use async_trait::async_trait;
use uuid::Uuid;

use super::model::{RefreshTokenData, SessionInfo};
use crate::errors::LMSError;

#[async_trait]
pub trait RefreshTokenRepository {
    async fn store_token(&self, jti: Uuid, data: RefreshTokenData) -> Result<(), LMSError>;
    async fn get_token(&self, jti: Uuid) -> Result<Option<RefreshTokenData>, LMSError>;
    async fn mark_as_rotated(&self, jti: Uuid) -> Result<(), LMSError>;
    async fn delete_token(&self, jti: Uuid) -> Result<(), LMSError>;
    async fn add_to_user_sessions(&self, user_id: Uuid, jti: Uuid) -> Result<(), LMSError>;
    async fn remove_from_user_sessions(&self, user_id: Uuid, jti: Uuid) -> Result<(), LMSError>;
    async fn get_user_sessions(&self, user_id: Uuid) -> Result<Vec<SessionInfo>, LMSError>;
    async fn delete_all_user_sessions(&self, user_id: Uuid) -> Result<(), LMSError>;
}
