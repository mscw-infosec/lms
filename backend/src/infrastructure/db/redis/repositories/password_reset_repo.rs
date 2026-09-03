use async_trait::async_trait;
use redis::{AsyncTypedCommands, SetExpiry, SetOptions};
use uuid::Uuid;

use crate::{
    domain::account::repository::PasswordResetCacheRepository, errors::Result,
    infrastructure::db::redis::RepositoryRedis,
};

impl RepositoryRedis {
    fn password_reset_key(token: &str) -> String {
        format!("password_reset:{token}")
    }
}

#[async_trait]
impl PasswordResetCacheRepository for RepositoryRedis {
    async fn store_reset(&self, token: &str, user_id: Uuid, ttl_secs: u64) -> Result<()> {
        let mut conn = self.conn();
        let key = Self::password_reset_key(token);

        let opts = SetOptions::default().with_expiration(SetExpiry::EX(ttl_secs));
        conn.set_options(&key, user_id.to_string(), opts).await?;

        Ok(())
    }

    async fn take_reset(&self, token: &str) -> Result<Option<Uuid>> {
        let mut conn = self.conn();
        let key = Self::password_reset_key(token);

        let Some(raw) = conn.get_del(&key).await? else {
            return Ok(None);
        };

        Ok(Uuid::parse_str(&raw).ok())
    }
}
