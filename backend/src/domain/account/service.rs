use std::sync::Arc;

use uuid::Uuid;

use crate::{
    domain::account::{
        model::UserModel,
        repository::{AccountCacheRepository, AccountRepository},
    },
    errors::{LMSError, Result},
};

#[derive(Clone)]
pub struct AccountService {
    db_repo: Arc<dyn AccountRepository + Send + Sync>,
    cache_repo: Arc<dyn AccountCacheRepository + Send + Sync>,
}

impl AccountService {
    pub const fn new(
        db_repo: Arc<dyn AccountRepository + Send + Sync>,
        cache_repo: Arc<dyn AccountCacheRepository + Send + Sync>,
    ) -> Self {
        Self {
            db_repo,
            cache_repo,
        }
    }

    pub async fn get_user(&self, id: Uuid) -> Result<UserModel> {
        if let Some(user) = self.cache_repo.get_user_by_id(id).await? {
            return Ok(user);
        }

        let user = self
            .db_repo
            .get_user_by_id(id)
            .await?
            .ok_or_else(|| LMSError::NotFound("No user was found with that id.".to_string()))?;

        self.cache_repo.store_user(&user).await?;

        Ok(user)
    }

    // TODO: future me, you need to implement those
    //
    // pub fn change_password(&self, id: Uuid) -> Result<()> {
    //     todo!()
    // }
    //
    // pub fn set_role(&self, id: Uuid, role: UserRole) -> Result<UserModel> {
    //     todo!()
    // }
    //
    // pub fn set_attributes(&self, id: Uuid, attributes: &Attributes) -> Result<UserModel> {
    //     todo!()
    // }
}
