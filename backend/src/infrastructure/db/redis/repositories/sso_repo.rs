use async_trait::async_trait;
use redis::{AsyncTypedCommands, SetExpiry, SetOptions};
use serde::{Serialize, de::DeserializeOwned};
use uuid::Uuid;

use crate::{
    domain::sso::{
        model::{AuthorizationCode, PendingAuthRequest, SsoRefreshTokenData},
        repository::SsoCacheRepository,
    },
    errors::Result,
    infrastructure::db::redis::RepositoryRedis,
};

impl RepositoryRedis {
    fn sso_request_key(id: &str) -> String {
        format!("sso:req:{id}")
    }

    fn sso_code_key(code: &str) -> String {
        format!("sso:code:{code}")
    }

    fn sso_refresh_key(token_hash: &str) -> String {
        format!("sso:rt:{token_hash}")
    }

    fn sso_grant_key(user_id: Uuid, client_id: &str) -> String {
        format!("sso:grants:{user_id}:{client_id}")
    }

    fn sso_revoked_key(jti: Uuid) -> String {
        format!("sso:revoked:{jti}")
    }

    async fn set_json<T: Serialize + Sync>(&self, key: &str, value: &T, ttl: u64) -> Result<()> {
        let mut conn = self.conn();
        let payload = serde_json::to_string(value)?;
        let opts = SetOptions::default().with_expiration(SetExpiry::EX(ttl));
        conn.set_options(key, payload, opts).await?;
        Ok(())
    }

    async fn get_json<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let mut conn = self.conn();
        let Some(raw) = conn.get(key).await? else {
            return Ok(None);
        };
        Ok(Some(serde_json::from_str(&raw)?))
    }

    async fn take_json<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let mut conn = self.conn();
        let Some(raw) = conn.get_del(key).await? else {
            return Ok(None);
        };
        Ok(Some(serde_json::from_str(&raw)?))
    }
}

#[async_trait]
impl SsoCacheRepository for RepositoryRedis {
    async fn store_request(&self, id: &str, req: &PendingAuthRequest, ttl_secs: u64) -> Result<()> {
        self.set_json(&Self::sso_request_key(id), req, ttl_secs)
            .await
    }

    async fn get_request(&self, id: &str) -> Result<Option<PendingAuthRequest>> {
        self.get_json(&Self::sso_request_key(id)).await
    }

    async fn take_request(&self, id: &str) -> Result<Option<PendingAuthRequest>> {
        self.take_json(&Self::sso_request_key(id)).await
    }

    async fn store_code(&self, code: &str, data: &AuthorizationCode, ttl_secs: u64) -> Result<()> {
        self.set_json(&Self::sso_code_key(code), data, ttl_secs)
            .await
    }

    async fn take_code(&self, code: &str) -> Result<Option<AuthorizationCode>> {
        self.take_json(&Self::sso_code_key(code)).await
    }

    async fn store_refresh(
        &self,
        token_hash: &str,
        data: &SsoRefreshTokenData,
        ttl_secs: u64,
    ) -> Result<()> {
        self.set_json(&Self::sso_refresh_key(token_hash), data, ttl_secs)
            .await?;

        let mut conn = self.conn();
        let grant_key = Self::sso_grant_key(data.user_id, &data.client_id);
        conn.sadd(&grant_key, token_hash).await?;
        conn.expire(&grant_key, i64::try_from(ttl_secs).unwrap_or(i64::MAX))
            .await?;

        Ok(())
    }

    async fn get_refresh(&self, token_hash: &str) -> Result<Option<SsoRefreshTokenData>> {
        self.get_json(&Self::sso_refresh_key(token_hash)).await
    }

    async fn delete_refresh(&self, token_hash: &str) -> Result<()> {
        let data: Option<SsoRefreshTokenData> =
            self.get_json(&Self::sso_refresh_key(token_hash)).await?;

        let mut conn = self.conn();
        conn.del(Self::sso_refresh_key(token_hash)).await?;

        if let Some(data) = data {
            conn.srem(
                Self::sso_grant_key(data.user_id, &data.client_id),
                token_hash,
            )
            .await?;
        }

        Ok(())
    }

    async fn delete_user_client_refresh(&self, user_id: Uuid, client_id: &str) -> Result<()> {
        let mut conn = self.conn();
        let grant_key = Self::sso_grant_key(user_id, client_id);

        for token_hash in conn.smembers(&grant_key).await? {
            conn.del(Self::sso_refresh_key(&token_hash)).await?;
        }
        conn.del(&grant_key).await?;

        Ok(())
    }

    async fn revoke_access_token(&self, jti: Uuid, ttl_secs: u64) -> Result<()> {
        let mut conn = self.conn();
        let opts = SetOptions::default().with_expiration(SetExpiry::EX(ttl_secs));
        conn.set_options(Self::sso_revoked_key(jti), "1", opts)
            .await?;
        Ok(())
    }

    async fn is_access_token_revoked(&self, jti: Uuid) -> Result<bool> {
        let mut conn = self.conn();
        Ok(conn.exists(Self::sso_revoked_key(jti)).await?)
    }
}
