use async_trait::async_trait;
use uuid::Uuid;

use super::model::{
    AuthorizationCode, NewSsoClient, PendingAuthRequest, SsoClient, SsoClientUpdate, SsoConsent,
    SsoRefreshTokenData,
};
use crate::errors::Result;
use crate::gen_openapi::DummyRepository;

#[impl_unimplemented::impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait SsoClientRepository {
    async fn create_client(&self, client: &NewSsoClient) -> Result<SsoClient>;
    async fn get_client(&self, client_id: &str) -> Result<Option<SsoClient>>;
    async fn list_clients(&self) -> Result<Vec<SsoClient>>;
    async fn update_client(&self, client_id: &str, update: &SsoClientUpdate) -> Result<SsoClient>;
    async fn set_client_secret(&self, client_id: &str, secret_hash: &str) -> Result<()>;
    async fn delete_client(&self, client_id: &str) -> Result<()>;

    async fn get_consent(&self, user_id: Uuid, client_id: &str) -> Result<Option<Vec<String>>>;
    async fn upsert_consent(&self, user_id: Uuid, client_id: &str, scopes: &[String])
    -> Result<()>;
    async fn list_consents(&self, user_id: Uuid) -> Result<Vec<SsoConsent>>;
    async fn delete_consent(&self, user_id: Uuid, client_id: &str) -> Result<()>;
}

#[impl_unimplemented::impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait SsoCacheRepository {
    async fn store_request(&self, id: &str, req: &PendingAuthRequest, ttl_secs: u64) -> Result<()>;
    async fn get_request(&self, id: &str) -> Result<Option<PendingAuthRequest>>;
    async fn take_request(&self, id: &str) -> Result<Option<PendingAuthRequest>>;

    async fn store_code(&self, code: &str, data: &AuthorizationCode, ttl_secs: u64) -> Result<()>;
    async fn take_code(&self, code: &str) -> Result<Option<AuthorizationCode>>;

    async fn store_refresh(
        &self,
        token_hash: &str,
        data: &SsoRefreshTokenData,
        ttl_secs: u64,
    ) -> Result<()>;
    async fn get_refresh(&self, token_hash: &str) -> Result<Option<SsoRefreshTokenData>>;
    async fn delete_refresh(&self, token_hash: &str) -> Result<()>;
    async fn delete_user_client_refresh(&self, user_id: Uuid, client_id: &str) -> Result<()>;

    async fn revoke_access_token(&self, jti: Uuid, ttl_secs: u64) -> Result<()>;
    async fn is_access_token_revoked(&self, jti: Uuid) -> Result<bool>;
}
