use super::model::BasicUser;
use crate::{errors::Result, gen_openapi::DummyRepository};
use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait BasicAuthRepository {
    async fn create(&self, user: &BasicUser) -> Result<()>;
    async fn is_exists(&self, username: &str, email: &str) -> Result<bool>;
    async fn get_by_username(&self, username: &str) -> Result<Option<BasicUser>>;
}
