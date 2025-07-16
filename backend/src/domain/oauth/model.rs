use std::fmt::Display;

use uuid::Uuid;

use crate::domain::account::model::UserRole;

#[derive(Debug)]
pub enum Providers {
    Yandex,
    Github,
}

#[derive(Debug)]
pub struct OAuth {
    pub client_id: String,
    pub username: String,
    pub email: String,
    pub avatar_url: String,
    pub provider: Providers,
}

pub struct OAuthUser {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: UserRole,
    pub provider: Providers,
    pub provider_user_id: String,
}

impl From<OAuth> for OAuthUser {
    fn from(value: OAuth) -> Self {
        Self {
            id: Uuid::new_v4(),
            username: value.username,
            email: value.email,
            role: UserRole::Student,
            provider: value.provider,
            provider_user_id: value.client_id,
        }
    }
}

impl Display for Providers {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Yandex => f.write_str("Yandex"),
            Self::Github => f.write_str("Github"),
        }
    }
}
