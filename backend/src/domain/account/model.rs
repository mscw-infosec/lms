use std::collections::HashMap;

use chrono::{DateTime, Utc};
use redis_macros::{FromRedisValue, ToRedisArgs};
use serde::{Deserialize, Serialize};
use sqlx::prelude::{FromRow, Type};
use utoipa::ToSchema;
use uuid::Uuid;

pub type Attributes = HashMap<String, String>;

#[derive(
    Default, Debug, Clone, Copy, Eq, PartialEq, PartialOrd, Type, Serialize, Deserialize, ToSchema,
)]
#[sqlx(type_name = "UserRole")]
pub enum UserRole {
    #[default]
    Student,
    Teacher,
    Admin,
}

#[derive(Serialize, Deserialize, Default, FromRow, Debug, FromRedisValue, ToRedisArgs)]
pub struct UserModel {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: UserRole,

    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub patronymic: Option<String>,
    pub email_verified: bool,

    pub password: Option<String>,
    pub attributes: Attributes,

    pub created_at: DateTime<Utc>,
}

impl UserModel {
    pub fn new(username: String, email: String, password: Option<String>, role: UserRole) -> Self {
        Self {
            id: Uuid::new_v4(),
            username,
            email,
            role,
            password,
            ..Default::default()
        }
    }

    #[must_use]
    pub fn is_profile_complete(&self) -> bool {
        let filled = |v: &Option<String>| v.as_deref().is_some_and(|s| !s.trim().is_empty());
        filled(&self.first_name) && filled(&self.last_name)
    }

    #[must_use]
    pub fn compose_username(
        last_name: &str,
        first_name: &str,
        patronymic: Option<&str>,
    ) -> String {
        let mut parts = vec![last_name.trim(), first_name.trim()];
        if let Some(p) = patronymic.map(str::trim).filter(|s| !s.is_empty()) {
            parts.push(p);
        }
        parts.retain(|s| !s.is_empty());
        parts.join(" ")
    }
}
