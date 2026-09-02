use async_trait::async_trait;
use redis::{AsyncTypedCommands, SetExpiry, SetOptions};
use uuid::Uuid;

use crate::{
    domain::account::repository::EmailVerificationCacheRepository,
    errors::Result,
    infrastructure::db::redis::RepositoryRedis,
};

impl RepositoryRedis {
    fn verification_key(token: &str) -> String {
        format!("email_verify:{token}")
    }
}

#[async_trait]
impl EmailVerificationCacheRepository for RepositoryRedis {
    async fn store_verification(&self, token: &str, user_id: Uuid, ttl_secs: u64) -> Result<()> {
        let mut conn = self.conn();
        let key = Self::verification_key(token);

        let opts = SetOptions::default().with_expiration(SetExpiry::EX(ttl_secs));
        conn.set_options(&key, user_id.to_string(), opts).await?;

        Ok(())
    }

    async fn take_verification(&self, token: &str) -> Result<Option<Uuid>> {
        let mut conn = self.conn();
        let key = Self::verification_key(token);

        let Some(raw) = conn.get_del(&key).await? else {
            return Ok(None);
        };

        Ok(Uuid::parse_str(&raw).ok())
    }
}
