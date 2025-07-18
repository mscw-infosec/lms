use async_trait::async_trait;
use dyn_clone::{DynClone, clone_trait_object};
use uuid::Uuid;

use super::model::UserModel;
use crate::errors::Result;

#[async_trait]
pub trait AccountRepository: DynClone {
    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserModel>>;
    async fn update_avatar(&self, id: Uuid, avatar_path: &str) -> Result<()>;
}

#[async_trait]
pub trait AccountCacheRepository: DynClone {
    fn user_key(id: Uuid) -> String
    where
        Self: Sized;
    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserModel>>;
    async fn store_user(&self, user: &UserModel) -> Result<()>;
    async fn update_avatar(&self, id: Uuid, avatar_path: &str) -> Result<()>;
}

clone_trait_object!(AccountRepository);
clone_trait_object!(AccountCacheRepository);
