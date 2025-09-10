use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;
use uuid::Uuid;

use super::model::UserModel;
use crate::domain::account::model::Attributes;
use crate::errors::Result;
use crate::gen_openapi::DummyRepository;

#[async_trait]
#[impl_unimplemented(DummyRepository)]
pub trait AccountRepository {
    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserModel>>;
    async fn get_user_by_email(&self, email: String) -> Result<Option<UserModel>>;
    async fn upsert_attributes(&self, id: Uuid, attributes: Attributes) -> Result<Attributes>;
    async fn get_user_active_ctfd_tasks(&self, user_id: Uuid) -> Result<Vec<usize>>;
    async fn list_users(&self, limit: i32, offset: i32) -> Result<Vec<UserModel>>;
}

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait AccountCacheRepository {
    fn user_key(id: Uuid) -> String
    where
        Self: Sized;
    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserModel>>;
    async fn store_user(&self, user: &UserModel) -> Result<()>;
    async fn update_attributes(&self, id: Uuid, attributes: Attributes) -> Result<()>;
}
