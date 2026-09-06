use validator::Validate;

#[derive(Clone, Validate, Default)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub server_port: u16,

    #[validate(url)]
    pub github_callback_url: String,
    pub github_client_id: String,
    pub github_client_secret: String,

    #[validate(url)]
    pub yandex_callback_url: String,
    pub yandex_client_id: String,
    pub yandex_client_secret: String,

    pub smartcaptcha_server_key: String,

    pub channel_id: String,
    pub iam_key_file: String,

    pub aws_access_key_id: String,
    pub aws_secret_access_key: String,
    pub s3_endpoint: String,
    pub s3_region: String,
    pub s3_bucket_name: String,

    #[validate(url)]
    pub frontend_redirect_url: String,

    #[validate(url)]
    pub frontend_base_url: String,

    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_username: String,
    pub smtp_password: String,
    pub smtp_from: String,

    // used for auth in LMS -> CTFd
    pub ctfd_token: String,
    // used for auth in CTFd -> LMS
    pub ctfd_auth_token: String,

    #[validate(url)]
    pub sso_issuer: String,

    pub sso_private_key: String,
}

pub fn env(key: &str) -> String {
    dotenvy::var(key).unwrap_or_else(|_| panic!("`{key}` environment variable not found"))
}

pub fn env_opt(key: &str) -> Option<String> {
    dotenvy::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn sso_private_key() -> anyhow::Result<String> {
    if let Some(path) = env_opt("SSO_PRIVATE_KEY_FILE") {
        return std::fs::read_to_string(&path)
            .map_err(|e| anyhow::anyhow!("Failed to read SSO_PRIVATE_KEY_FILE at `{path}`: {e}"));
    }

    Ok(env_opt("SSO_PRIVATE_KEY")
        .map(|key| key.replace("\\n", "\n"))
        .unwrap_or_default())
}

fn default_issuer(callback_url: &str) -> String {
    url::Url::parse(callback_url).map_or_else(
        |_| "http://localhost:8000/api/sso".to_string(),
        |url| format!("{}/api/sso", url.origin().ascii_serialization()),
    )
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let config = Self {
            database_url: env("DATABASE_URL"),
            redis_url: env("REDIS_URL"),
            jwt_secret: env("JWT_SECRET"),
            server_port: env("PORT").parse()?,

            github_client_id: env("GITHUB_CLIENT_ID"),
            github_client_secret: env("GITHUB_CLIENT_SECRET"),
            github_callback_url: env("GITHUB_CALLBACK_URL"),

            yandex_client_id: env("YANDEX_CLIENT_ID"),
            yandex_client_secret: env("YANDEX_CLIENT_SECRET"),
            yandex_callback_url: env("YANDEX_CALLBACK_URL"),

            smartcaptcha_server_key: env("SMARTCAPTCHA_SERVER_KEY"),

            channel_id: env("CHANNEL_ID"),
            iam_key_file: env("IAM_KEY_FILE"),

            aws_access_key_id: env("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key: env("AWS_SECRET_ACCESS_KEY"),
            s3_endpoint: env("S3_ENDPOINT"),
            s3_region: env("S3_REGION"),
            s3_bucket_name: env("S3_BUCKET_NAME"),

            frontend_redirect_url: env("FRONTEND_REDIRECT_URL"),
            frontend_base_url: env("FRONTEND_BASE_URL"),

            smtp_host: env("SMTP_HOST"),
            smtp_port: env("SMTP_PORT").parse()?,
            smtp_username: env("SMTP_USERNAME"),
            smtp_password: env("SMTP_PASSWORD"),
            smtp_from: env("SMTP_FROM"),

            ctfd_token: env("CTFD_TOKEN"),
            ctfd_auth_token: env("CTFD_AUTH_TOKEN"),

            sso_issuer: env_opt("SSO_ISSUER")
                .unwrap_or_else(|| default_issuer(&env("YANDEX_CALLBACK_URL"))),
            sso_private_key: sso_private_key()?,
        };

        if let Err(validation_errors) = config.validate() {
            return Err(anyhow::anyhow!(
                "Config validation failed: {:?}",
                validation_errors
            ));
        }

        Ok(config)
    }
}
