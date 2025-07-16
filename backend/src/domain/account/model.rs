use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::{FromRow, Type};
use utoipa::ToSchema;
use uuid::Uuid;

pub type Attributes = HashMap<String, String>;

#[derive(
    Default, Debug, Clone, Copy, Eq, PartialEq, PartialOrd, Serialize, Deserialize, ToSchema, Type,
)]
#[sqlx(type_name = "UserRole")]
pub enum UserRole {
    #[default]
    Student,
    Teacher,
    Admin,
}

#[derive(Serialize, Deserialize, Default, ToSchema, FromRow)]
pub struct User {
    #[serde(skip)]
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: UserRole,

    #[serde(skip)]
    pub password: Option<String>,
    pub attributes: Attributes,

    #[serde(skip)]
    pub created_at: DateTime<Utc>,
}

impl User {
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
