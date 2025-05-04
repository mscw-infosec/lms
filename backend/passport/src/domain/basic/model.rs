use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Default)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password: String,
    pub created_at: DateTime<Utc>,
}

impl User {
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
