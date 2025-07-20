use async_trait::async_trait;
use dyn_clone::DynClone;
use uuid::Uuid;

use super::model::{RefreshTokenData, SessionInfo};
use crate::errors::LMSError;

#[async_trait]
pub trait RefreshTokenRepository: DynClone {
    fn token_key(jti: Uuid) -> String
    where
        Self: Sized;

    fn user_sessions_key(user_id: Uuid) -> String
    where
        Self: Sized;

    async fn store_token(&self, jti: Uuid, data: RefreshTokenData) -> Result<(), LMSError>;
    async fn get_token(&self, jti: Uuid) -> Result<Option<RefreshTokenData>, LMSError>;
    async fn mark_as_rotated(&self, jti: Uuid) -> Result<(), LMSError>;
    async fn check_if_rotated(&self, jti: Uuid) -> Result<bool, LMSError>;
    async fn delete_token(&self, jti: Uuid) -> Result<(), LMSError>;
    async fn add_to_user_sessions(&self, user_id: Uuid, jti: Uuid) -> Result<(), LMSError>;
    async fn remove_from_user_sessions(&self, user_id: Uuid, jti: Uuid) -> Result<(), LMSError>;
    async fn get_user_sessions(&self, user_id: Uuid) -> Result<Vec<SessionInfo>, LMSError>;
    async fn delete_all_user_sessions(&self, user_id: Uuid) -> Result<(), LMSError>;
}

dyn_clone::clone_trait_object!(RefreshTokenRepository);
