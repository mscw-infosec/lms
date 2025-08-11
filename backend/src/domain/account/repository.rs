use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;
use uuid::Uuid;

use super::model::UserModel;
use crate::{errors::Result, gen_openapi::DummyRepository};

#[impl_unimplemented]
#[async_trait]
pub trait AccountRepository {
    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserModel>>;
}

#[impl_unimplemented]
#[async_trait]
pub trait AccountCacheRepository {
    fn user_key(id: Uuid) -> String
    where
        Self: Sized;
    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserModel>>;
    async fn store_user(&self, user: &UserModel) -> Result<()>;
}
