use reqwest::Client;
use serde::Deserialize;
use tracing::{error, info, warn};

use crate::errors::LMSError;

const SMARTCAPTCHA_VALIDATE_URL: &str = "https://smartcaptcha.yandexcloud.net/validate";

#[derive(Clone)]
pub struct SmartCaptchaService {
    client: Client,
    server_key: Option<String>,
}

#[derive(Deserialize)]
struct ValidateResponse {
    /// `"ok"` when the challenge was solved, `"failed"` otherwise.
    status: String,
    #[serde(default)]
    message: String,
}

impl SmartCaptchaService {
    #[must_use]
    pub fn new(client: Client, server_key: &str) -> Self {
        let server_key = Some(server_key.trim())
            .filter(|key| !key.is_empty())
            .map(ToString::to_string);

        if server_key.is_none() {
            warn!(
                "SMARTCAPTCHA_SERVER_KEY is empty - SmartCaptcha verification is DISABLED. \
                 Registration and login are unprotected against bots."
            );
        } else {
            info!("SmartCaptcha verification enabled");
        }

        Self { client, server_key }
    }

    #[must_use]
    pub const fn is_enabled(&self) -> bool {
        self.server_key.is_some()
    }

    pub async fn verify(&self, token: &str, ip: Option<&str>) -> Result<(), LMSError> {
        let Some(secret) = self.server_key.as_deref() else {
            return Ok(());
        };

        let token = token.trim();
        if token.is_empty() {
            return Err(LMSError::CaptchaFailed);
        }

        // `None` means Yandex couldn't give us a verdict: see `validate`.
        let Some(verdict) = self.validate(secret, token, ip).await else {
            return Ok(());
        };

        if verdict.status == "ok" {
            return Ok(());
        }

        Err(LMSError::CaptchaFailed)
    }

    async fn validate(
        &self,
        secret: &str,
        token: &str,
        ip: Option<&str>,
    ) -> Option<ValidateResponse> {
        let mut query = vec![("secret", secret), ("token", token)];
        if let Some(ip) = ip {
            query.push(("ip", ip));
        }

        let response = self
            .client
            .get(SMARTCAPTCHA_VALIDATE_URL)
            .query(&query)
            .send()
            .await
            .inspect_err(|err| {
                error!(error = ?err, "SmartCaptcha validation request failed - allowing the request through");
            })
            .ok()?;

        let status = response.status();
        match response.json::<ValidateResponse>().await {
            Ok(verdict) => {
                if !status.is_success() {
                    // Yandex refused the call itself rather than judging
                    error!(
                        %status,
                        message = %verdict.message,
                        "SmartCaptcha refused the validation request - check SMARTCAPTCHA_SERVER_KEY"
                    );
                }
                Some(verdict)
            }
            Err(err) => {
                error!(
                    %status,
                    error = ?err,
                    "no verdict in the SmartCaptcha response - allowing the request through"
                );
                None
            }
        }
    }
}
