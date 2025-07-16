use async_trait::async_trait;
use uuid::Uuid;

use super::model::User;
use crate::errors::Result;

#[async_trait]
pub trait AccountRepository {
    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<User>>;
}
