use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;
use uuid::Uuid;

use crate::errors::LMSError;
use crate::gen_openapi::DummyRepository;

use super::model::{OAuth, OAuthUser};

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait OAuthRepository {
    async fn find_by_email(&self, email: &str) -> Result<Option<Uuid>, LMSError>;
    async fn create_user_with_provider(&self, user: &OAuthUser) -> Result<(), LMSError>;
    async fn add_provider(&self, user_id: Uuid, provider: OAuth) -> Result<(), LMSError>;
    async fn update_ctfd_account(&self, user_id: Uuid, ctfd_id: i32) -> Result<(), LMSError>;
}
