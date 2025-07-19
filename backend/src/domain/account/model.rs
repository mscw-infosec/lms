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
}
