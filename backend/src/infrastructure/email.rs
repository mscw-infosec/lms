use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::{Mailbox, MultiPart, SinglePart, header::ContentType},
    transport::smtp::authentication::Credentials,
};
use tracing::{error, info};

use crate::{config::Config, errors::LMSError};

#[derive(Clone)]
pub struct EmailService {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
    frontend_base_url: String,
}

impl EmailService {
    pub fn new(config: &Config) -> Result<Self, LMSError> {
        let use_auth = !config.smtp_username.is_empty();
        let tls_mode = if use_auth {
            "implicit-tls (relay)"
        } else {
            "none (plaintext/dangerous)"
        };

        info!(
            smtp.host = %config.smtp_host,
            smtp.port = config.smtp_port,
            smtp.tls = tls_mode,
            smtp.auth = use_auth,
            smtp.username = %config.smtp_username,
            smtp.from = %config.smtp_from,
            "initializing SMTP email transport"
        );

        let builder = if use_auth {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&config.smtp_host)
                .map_err(|e| {
                    error!(smtp.host = %config.smtp_host, error = ?e, "failed to build SMTP relay");
                    LMSError::ServerError(format!("Invalid SMTP relay: {e:?}"))
                })?
                .port(config.smtp_port)
                .credentials(Credentials::new(
                    config.smtp_username.clone(),
                    config.smtp_password.clone(),
                ))
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.smtp_host)
                .port(config.smtp_port)
        };

        let from = config.smtp_from.parse::<Mailbox>().map_err(|e| {
            error!(smtp.from = %config.smtp_from, error = ?e, "invalid SMTP_FROM address");
            LMSError::ServerError(format!("Invalid SMTP_FROM address: {e}"))
        })?;

        info!("SMTP email transport initialized");

        Ok(Self {
            transport: builder.build(),
            from,
            frontend_base_url: config.frontend_base_url.trim_end_matches('/').to_string(),
        })
    }

    pub async fn verify_connection(&self) {
        match self.transport.test_connection().await {
            Ok(true) => info!("SMTP connection test succeeded - outgoing email is ready"),
            Ok(false) => error!(
                "SMTP connection test reported the server is not ready - outgoing email may not work"
            ),
            Err(e) => error!(
                error = ?e,
                "SMTP connection test FAILED - outgoing email will not work until this is fixed"
            ),
        }
    }

    async fn deliver(
        &self,
        to: &str,
        subject: &str,
        text: String,
        html: String,
    ) -> Result<(), LMSError> {
        let to_mbox = to.parse::<Mailbox>().map_err(|e| {
            error!(recipient = %to, error = ?e, "invalid recipient email address");
            LMSError::ShitHappened(format!("Invalid recipient address: {e}"))
        })?;

        let message = Message::builder()
            .from(self.from.clone())
            .to(to_mbox)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_PLAIN)
                            .body(text),
                    )
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_HTML)
                            .body(html),
                    ),
            )
            .map_err(|e| {
                error!(recipient = %to, subject, error = ?e, "failed to build email message");
                LMSError::ServerError(format!("Failed to build email: {e}"))
            })?;

        info!(recipient = %to, subject, "sending email via SMTP");

        match self.transport.send(message).await {
            Ok(_response) => {
                // info!(
                //     recipient = %to,
                //     subject,
                //     smtp.code = ?response.code(),
                //     "email sent successfully"
                // );
                Ok(())
            }
            Err(e) => {
                error!(
                    recipient = %to,
                    subject,
                    error = ?e,
                    "failed to send email via SMTP"
                );
                Err(LMSError::ServerError(format!("Failed to send email: {e:?}")))
            }
        }
    }

    /// Send an email-verification link to `to` carrying the opaque `token`.
    pub async fn send_verification(&self, to: &str, token: &str) -> Result<(), LMSError> {
        let link = format!("{}/verify?token={token}", self.frontend_base_url);

        let text = format!(
            "Welcome to the LMS!\n\nPlease confirm your email address by opening the link below:\n\n{link}\n\nIf you did not create this account, you can ignore this email."
        );
        let html = format!(
            r#"<div style="font-family:sans-serif;max-width:480px;margin:auto">
  <h2>Welcome to the LMS!</h2>
  <p>Please confirm your email address by clicking the button below.</p>
  <p><a href="{link}" style="display:inline-block;padding:12px 20px;background:#dc2626;color:#fff;border-radius:8px;text-decoration:none">Verify email</a></p>
  <p style="color:#64748b;font-size:13px">Or open this link: <a href="{link}">{link}</a></p>
  <p style="color:#94a3b8;font-size:12px">If you did not create this account, you can safely ignore this email.</p>
</div>"#
        );

        self.deliver(to, "Verify your LMS email", text, html).await
    }

    /// Send a password-reset link to `to` carrying the opaque `token`.
    pub async fn send_password_reset(&self, to: &str, token: &str) -> Result<(), LMSError> {
        let link = format!("{}/reset-password?token={token}", self.frontend_base_url);

        let text = format!(
            "We received a request to reset your LMS password.\n\nOpen the link below to choose a new password:\n\n{link}\n\nThe link expires in 1 hour. If you did not request this, you can ignore this email - your password will stay the same."
        );
        let html = format!(
            r#"<div style="font-family:sans-serif;max-width:480px;margin:auto">
  <h2>Reset your LMS password</h2>
  <p>We received a request to reset your password. Click the button below to choose a new one.</p>
  <p><a href="{link}" style="display:inline-block;padding:12px 20px;background:#dc2626;color:#fff;border-radius:8px;text-decoration:none">Reset password</a></p>
  <p style="color:#64748b;font-size:13px">Or open this link: <a href="{link}">{link}</a></p>
  <p style="color:#94a3b8;font-size:12px">This link expires in 1 hour. If you did not request a reset, you can safely ignore this email.</p>
</div>"#
        );

        self.deliver(to, "Reset your LMS password", text, html).await
    }
}
