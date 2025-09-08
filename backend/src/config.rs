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

    pub channel_id: String,
    pub iam_key_file: String,

    pub aws_access_key_id: String,
    pub aws_secret_access_key: String,
    pub s3_endpoint: String,
    pub s3_region: String,
    pub s3_bucket_name: String,

    #[validate(url)]
    pub frontend_redirect_url: String,

    // used for auth in LMS -> CTFd
    pub ctfd_token: String,
    // used for auth in CTFd -> LMS
    pub ctfd_auth_token: String,
}

pub fn env(key: &str) -> String {
    dotenvy::var(key).unwrap_or_else(|_| panic!("`{key}` environment variable not found"))
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

            channel_id: env("CHANNEL_ID"),
            iam_key_file: env("IAM_KEY_FILE"),

            aws_access_key_id: env("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key: env("AWS_SECRET_ACCESS_KEY"),
            s3_endpoint: env("S3_ENDPOINT"),
            s3_region: env("S3_REGION"),
            s3_bucket_name: env("S3_BUCKET_NAME"),

            frontend_redirect_url: env("FRONTEND_REDIRECT_URL"),
            ctfd_token: env("CTFD_TOKEN"),
            ctfd_auth_token: env("CTFD_AUTH_TOKEN"),
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
