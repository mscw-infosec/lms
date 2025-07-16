use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Default, FromRow, ToSchema)]
pub struct BasicUser {
    #[serde(skip)]
    pub id: Uuid,
    pub username: String,
    pub email: String,

    #[serde(skip)]
    pub password: String,

    #[serde(skip)]
    pub created_at: DateTime<Utc>,
}

impl BasicUser {
    pub fn new(username: String, email: String, password: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4(),
            username,
            email,
            password,
            ..Default::default()
        }
    }
}
