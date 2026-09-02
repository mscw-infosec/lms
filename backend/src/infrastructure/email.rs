use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::{Mailbox, MultiPart, SinglePart, header::ContentType},
    transport::smtp::authentication::Credentials,
};

use crate::{config::Config, errors::LMSError};

#[derive(Clone)]
pub struct EmailService {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
    frontend_base_url: String,
}

impl EmailService {
    pub fn new(config: &Config) -> Result<Self, LMSError> {
        let builder = if config.smtp_username.is_empty() {
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.smtp_host)
                .port(config.smtp_port)
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.smtp_host)
                .map_err(|e| LMSError::ServerError(format!("Invalid SMTP relay: {e}")))?
                .port(config.smtp_port)
                .credentials(Credentials::new(
                    config.smtp_username.clone(),
                    config.smtp_password.clone(),
                ))
        };

        let from = config
            .smtp_from
            .parse::<Mailbox>()
            .map_err(|e| LMSError::ServerError(format!("Invalid SMTP_FROM address: {e}")))?;

        Ok(Self {
            transport: builder.build(),
            from,
            frontend_base_url: config.frontend_base_url.trim_end_matches('/').to_string(),
        })
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

        let to_mbox = to
            .parse::<Mailbox>()
            .map_err(|e| LMSError::ShitHappened(format!("Invalid recipient address: {e}")))?;

        let message = Message::builder()
            .from(self.from.clone())
            .to(to_mbox)
            .subject("Verify your LMS email")
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
            .map_err(|e| LMSError::ServerError(format!("Failed to build email: {e}")))?;

        self.transport
            .send(message)
            .await
            .map_err(|e| LMSError::ServerError(format!("Failed to send email: {e}")))?;

        Ok(())
    }
}
