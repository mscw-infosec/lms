use async_trait::async_trait;
use chrono::{DateTime, Utc};
use redis::{AsyncTypedCommands, FieldExistenceCheck, HashFieldExpirationOptions, SetExpiry};
use uuid::Uuid;

use crate::{
    domain::refresh_token::{
        model::{RefreshTokenData, RotationClaim, SessionInfo},
        repository::RefreshTokenRepository,
    },
    errors::LMSError,
    infrastructure::db::redis::RepositoryRedis,
    utils::{from_pairs, to_pairs},
};

fn expire_at(expires_at: DateTime<Utc>) -> HashFieldExpirationOptions {
    let secs = u64::try_from(expires_at.timestamp()).unwrap_or(0);
    HashFieldExpirationOptions::default().set_expiration(SetExpiry::EXAT(secs))
}

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

        let ex = expire_at(data.expires_at);
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

    async fn claim_rotation(
        &self,
        jti: Uuid,
        new_jti: Uuid,
        expires_at: DateTime<Utc>,
    ) -> Result<RotationClaim, LMSError> {
        let mut conn = self.conn();
        let key = Self::token_key(jti);

        let claim = expire_at(expires_at).set_existence_check(FieldExistenceCheck::FNX);
        let rotated_at = Utc::now();
        let won = conn
            .hset_ex(
                &key,
                &claim,
                &[
                    ("replaced_by", serde_json::to_string(&new_jti)?),
                    ("rotated_at", serde_json::to_string(&rotated_at)?),
                ],
            )
            .await?;

        if won {
            conn.hset_ex(&key, &expire_at(expires_at), &[("rotated", "true")])
                .await?;
            return Ok(RotationClaim::Won);
        }

        let Some(successor) = conn
            .hget(&key, "replaced_by")
            .await?
            .and_then(|raw| serde_json::from_str::<Uuid>(&raw).ok())
        else {
            return Ok(RotationClaim::Gone);
        };

        let rotated_at = conn
            .hget(&key, "rotated_at")
            .await?
            .and_then(|raw| serde_json::from_str::<DateTime<Utc>>(&raw).ok());

        Ok(RotationClaim::Lost {
            successor,
            rotated_at,
        })
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
                    device_id: token_data.device_id.clone(),
                    device_label: token_data.device_label.clone(),
                    user_agent: token_data.user_agent.clone(),
                    ip: token_data.ip.clone(),
                    last_used: token_data.last_used,
                    issued_at: token_data.issued_at,
                });
            }
        }

        Ok(sessions)
    }

    async fn get_user_token_data(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<(Uuid, RefreshTokenData)>, LMSError> {
        let mut conn = self.conn();
        let key = Self::user_sessions_key(user_id);

        let jtis = conn.smembers(&key).await?;
        let mut result = Vec::new();

        for jti_str in jtis {
            if let Ok(jti) = Uuid::parse_str(&jti_str)
                && let Some(token_data) = self.get_token(jti).await?
            {
                result.push((jti, token_data));
            }
        }

        Ok(result)
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
