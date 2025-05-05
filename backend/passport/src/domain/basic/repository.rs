use crate::errors::Result;
use async_trait::async_trait;
use uuid::Uuid;

use super::model::User;

#[async_trait]
pub trait BasicAuthRepository {
    async fn create(&self, user: &User) -> Result<()>;
    async fn is_exists(&self, username: &str, email: &str) -> Result<bool>;
    async fn get_by_username(&self, username: &str) -> Result<Option<User>>;
    async fn delete(&self, user_id: Uuid) -> Result<()>;
    async fn list(&self) -> Result<Vec<User>>;
    async fn update(&self, user: &User) -> Result<()>;
}
