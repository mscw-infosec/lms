use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

use crate::{
    domain::refresh_token::{
        model::{DeviceInfo, RefreshTokenData, RotationClaim, SessionInfo},
        repository::RefreshTokenRepository,
    },
    errors::{LMSError, Result},
    infrastructure::jwt::{JWT, RefreshTokenClaim},
    repo,
};

const ROTATION_GRACE: Duration = Duration::seconds(60);

#[derive(Clone)]
pub struct RefreshTokenService {
    repo: repo!(RefreshTokenRepository),
    jwt: Arc<JWT>,
}

impl RefreshTokenService {
    pub fn new(repo: repo!(RefreshTokenRepository), jwt: Arc<JWT>) -> Self {
        Self { repo, jwt }
    }

    /// Creates a session for a login. Enforces one session per device
    /// fingerprint: if the user already has a session from the same device
    /// (matching `User-Agent` + IP), that session is revoked and its identity
    /// and original login time are reused, so devices don't pile up as
    /// duplicate sessions on repeated logins.
    pub async fn create_refresh_token(
        &self,
        user_id: Uuid,
        device: DeviceInfo,
    ) -> Result<(String, Uuid)> {
        let (device, issued_at) = self.reuse_or_new_device(user_id, device).await?;
        self.store_token_with(user_id, device, issued_at).await
    }

    /// Finds any existing session for this device fingerprint, revokes it, and
    /// returns the device identity (reused `device_id`) plus login time to use
    /// for the new token. Falls back to the fresh device / now when there is no
    /// match or the request has no usable fingerprint.
    async fn reuse_or_new_device(
        &self,
        user_id: Uuid,
        device: DeviceInfo,
    ) -> Result<(DeviceInfo, DateTime<Utc>)> {
        // Without a user agent there is nothing meaningful to fingerprint, so
        // avoid collapsing unrelated sessions into one.
        if device.user_agent.is_none() {
            return Ok((device, Utc::now()));
        }

        let matches: Vec<(Uuid, RefreshTokenData)> = self
            .repo
            .get_user_token_data(user_id)
            .await?
            .into_iter()
            .filter(|(_, d)| d.user_agent == device.user_agent && d.ip == device.ip)
            .collect();

        // Reuse the earliest matching session's identity + login time.
        let (device_id, issued_at) = match matches.iter().min_by_key(|(_, d)| d.issued_at) {
            Some((_, d)) => (d.device_id.clone(), d.issued_at),
            None => (device.device_id.clone(), Utc::now()),
        };

        for (jti, _) in &matches {
            self.repo.delete_token(*jti).await?;
            self.repo.remove_from_user_sessions(user_id, *jti).await?;
        }

        Ok((
            DeviceInfo {
                device_id,
                ..device
            },
            issued_at,
        ))
    }

    async fn store_token_with(
        &self,
        user_id: Uuid,
        device: DeviceInfo,
        issued_at: DateTime<Utc>,
    ) -> Result<(String, Uuid)> {
        self.store_token_as(user_id, Uuid::new_v4(), device, issued_at)
            .await
    }

    async fn store_token_as(
        &self,
        user_id: Uuid,
        jti: Uuid,
        device: DeviceInfo,
        issued_at: DateTime<Utc>,
    ) -> Result<(String, Uuid)> {
        let now = Utc::now();
        let expires_at = now + Duration::days(30);

        let token_data = RefreshTokenData {
            user_id,
            device_id: device.device_id,
            user_agent: device.user_agent,
            device_label: device.device_label,
            ip: device.ip,
            issued_at,
            last_used: now,
            expires_at,
            rotated: false,
            replaced_by: None,
            rotated_at: None,
        };

        self.repo.store_token(jti, token_data).await?;
        self.repo.add_to_user_sessions(user_id, jti).await?;

        let token = self.jwt.generate_refresh_token(user_id, jti)?;
        Ok((token, jti))
    }

    pub async fn validate_and_rotate(&self, token: &RefreshTokenClaim) -> Result<(String, Uuid)> {
        let token_data = self
            .repo
            .get_token(token.jti)
            .await?
            .ok_or_else(|| LMSError::Unauthorized("Invalid refresh token".to_string()))?;

        if token_data.expires_at < Utc::now() {
            return Err(LMSError::Unauthorized("Token has expired".to_string()));
        }

        if let Some(successor) = token_data.replaced_by {
            return self.reissue(token.sub, successor, token_data.rotated_at);
        }

        if token_data.rotated {
            return Err(LMSError::Unauthorized(
                "Token has already been used".to_string(),
            ));
        }

        let new_jti = Uuid::new_v4();
        match self
            .repo
            .claim_rotation(token.jti, new_jti, token_data.expires_at)
            .await?
        {
            RotationClaim::Lost {
                successor,
                rotated_at,
            } => return self.reissue(token.sub, successor, rotated_at),
            RotationClaim::Gone => {
                return Err(LMSError::Unauthorized("Invalid refresh token".to_string()));
            }
            RotationClaim::Won => {}
        }

        // Carry the device fingerprint and original login time forward so the
        // session keeps its identity across rotations.
        let issued_at = token_data.issued_at;
        let device = DeviceInfo::from(token_data);

        self.repo
            .remove_from_user_sessions(token.sub, token.jti)
            .await?;

        self.store_token_as(token.sub, new_jti, device, issued_at)
            .await
    }

    fn reissue(
        &self,
        sub: Uuid,
        successor: Uuid,
        rotated_at: Option<DateTime<Utc>>,
    ) -> Result<(String, Uuid)> {
        let within_grace = rotated_at.is_none_or(|at| Utc::now() - at <= ROTATION_GRACE);
        if !within_grace {
            return Err(LMSError::Unauthorized(
                "Token has already been used".to_string(),
            ));
        }

        let token = self.jwt.generate_refresh_token(sub, successor)?;
        Ok((token, successor))
    }

    pub async fn is_usable(&self, jti: Uuid) -> Result<bool> {
        let Some(data) = self.repo.get_token(jti).await? else {
            return Ok(false);
        };

        if data.expires_at < Utc::now() {
            return Ok(false);
        }

        match (data.rotated, data.rotated_at) {
            (false, _) => Ok(true),
            (true, Some(at)) => Ok(Utc::now() - at <= ROTATION_GRACE),
            (true, None) => Ok(false),
        }
    }

    pub async fn get_user_sessions(
        &self,
        user_id: Uuid,
        current_jti: Uuid,
    ) -> Result<Vec<SessionInfo>> {
        self.repo.get_user_sessions(user_id, current_jti).await
    }

    pub async fn logout_session(&self, user_id: Uuid, jti: Uuid) -> Result<()> {
        self.repo.delete_token(jti).await?;
        self.repo.remove_from_user_sessions(user_id, jti).await?;
        Ok(())
    }

    pub async fn logout_all_sessions(&self, user_id: Uuid) -> Result<()> {
        self.repo.delete_all_user_sessions(user_id).await?;
        Ok(())
    }
}
