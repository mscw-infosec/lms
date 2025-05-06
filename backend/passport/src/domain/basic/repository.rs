use crate::errors::Result;
use async_trait::async_trait;

use super::model::BasicUser;

#[async_trait]
pub trait BasicAuthRepository {
    async fn create(&self, user: &BasicUser) -> Result<()>;
    async fn is_exists(&self, username: &str, email: &str) -> Result<bool>;
    async fn get_by_username(&self, username: &str) -> Result<Option<BasicUser>>;
}
