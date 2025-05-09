#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub server_port: u16,
    pub base_url: String,
    pub github_client_id: String,
    pub github_client_secret: String,
}

pub fn env(key: &str) -> String {
    dotenvy::var(key).unwrap_or_else(|_| panic!("`{key}` environment variable not found"))
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: env("DATABASE_URL"),
            jwt_secret: env("JWT_SECRET"),
            server_port: env("PORT").parse()?,
            github_client_id: env("GITHUB_CLIENT_ID"),
            github_client_secret: env("GITHUB_CLIENT_SECRET"),
            base_url: env("BASE_URL"),
        })
    }
}
