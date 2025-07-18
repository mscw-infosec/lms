use validator::Validate;

#[derive(Clone, Validate)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,

    pub server_port: u16,

    pub github_client_id: String,
    pub github_client_secret: String,
    #[validate(url)]
    pub github_callback_url: String,

    pub yandex_client_id: String,
    pub yandex_client_secret: String,
    #[validate(url)]
    pub yandex_callback_url: String,

    pub channel_id: String,
    pub iam_key_file: String,
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
        };

        config.validate().expect("Config should be correct");

        Ok(config)
    }
}
