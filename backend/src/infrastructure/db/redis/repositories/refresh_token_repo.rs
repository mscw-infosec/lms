use async_trait::async_trait;
use redis::{AsyncTypedCommands, HashFieldExpirationOptions, SetExpiry};
use uuid::Uuid;

use crate::{
    domain::refresh_token::{
        model::{RefreshTokenData, SessionInfo},
        repository::RefreshTokenRepository,
    },
    errors::LMSError,
    infrastructure::db::redis::RepositoryRedis,
    utils::{from_pairs, to_pairs},
};

#[async_trait]
impl RefreshTokenRepository for RepositoryRedis {
    fn token_key(jti: Uuid) -> String {
        format!("refresh:{jti}")
    }

    fn user_sessions_key(user_id: Uuid) -> String {
        format!("user_sessions:{user_id}")
    }

    async fn store_token(&self, jti: Uuid, data: RefreshTokenData) -> Result<(), LMSError> {
        let mut conn = self.conn();
        let key = Self::token_key(jti);

        let set_expiry = SetExpiry::EX(30 * 24 * 60 * 60);
        let ex = HashFieldExpirationOptions::default().set_expiration(set_expiry);

        conn.hset_ex(key, &ex, &to_pairs(&data)).await?;

        Ok(())
    }

    async fn get_token(&self, jti: Uuid) -> Result<Option<RefreshTokenData>, LMSError> {
        let mut conn = self.conn();
        let key = Self::token_key(jti);

        let data_json = conn.hgetall(&key).await?;
        if data_json.is_empty() {
            return Ok(None);
        }

        Ok(Some(from_pairs(data_json)?))
    }

    async fn mark_as_rotated(&self, jti: Uuid) -> Result<(), LMSError> {
        let mut conn = self.conn();
        let key = Self::token_key(jti);

        conn.hset(&key, "rotated", "true").await?;
        Ok(())
    }

    async fn check_if_rotated(&self, jti: Uuid) -> Result<bool, LMSError> {
        let mut conn = self.conn();
        let key = Self::token_key(jti);

        if let Some(rotated) = conn.hget(&key, "rotated").await?
            && rotated == "false"
        {
            return Ok(false);
        }

        Ok(true)
    }

    async fn delete_token(&self, jti: Uuid) -> Result<(), LMSError> {
        let mut conn = self.conn();
        let key = Self::token_key(jti);

        conn.del(&key).await?;
        Ok(())
    }

    async fn add_to_user_sessions(&self, user_id: Uuid, jti: Uuid) -> Result<(), LMSError> {
        let mut conn = self.conn();
        let key = Self::user_sessions_key(user_id);

        conn.sadd(&key, jti.to_string()).await?;
        Ok(())
    }

    async fn remove_from_user_sessions(&self, user_id: Uuid, jti: Uuid) -> Result<(), LMSError> {
        let mut conn = self.conn();
        let key = Self::user_sessions_key(user_id);

        conn.srem(&key, jti.to_string()).await?;
        Ok(())
    }

    async fn get_user_sessions(
        &self,
        user_id: Uuid,
        current_jti: Uuid,
    ) -> Result<Vec<SessionInfo>, LMSError> {
        let mut conn = self.conn();
        let key = Self::user_sessions_key(user_id);

        let jtis = conn.smembers(&key).await?;
        let mut sessions = Vec::new();

        for jti_str in jtis {
            if let Ok(jti) = Uuid::parse_str(&jti_str)
                && let Some(token_data) = self.get_token(jti).await?
            {
                sessions.push(SessionInfo {
                    jti,
                    is_current: jti == current_jti,
                    device_id: token_data.device_id,
                    last_used: token_data.last_used,
                    issued_at: token_data.issued_at,
                });
            }
        }

        Ok(sessions)
    }

    async fn delete_all_user_sessions(&self, user_id: Uuid) -> Result<(), LMSError> {
        let mut conn = self.conn();
        let key = Self::user_sessions_key(user_id);

        let jtis = conn.smembers(&key).await?;

        for jti_str in jtis {
            if let Ok(jti) = Uuid::parse_str(&jti_str) {
                self.delete_token(jti).await?;
            }
        }

        conn.del(&key).await?;

        Ok(())
    }
}
