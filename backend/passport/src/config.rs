#[derive(Clone)]
pub struct Config {
    database_url: String,
    jwt_secret: String,
    server_port: u16,
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
        })
    }

    pub const fn database_url(&self) -> &str {
        self.database_url.as_str()
    }

    pub const fn port(&self) -> u16 {
        self.server_port
    }

    pub const fn jwt_secret(&self) -> &str {
        self.jwt_secret.as_str()
    }
}
