use chrono::{DateTime, Utc};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(FromRow)]
pub struct CourseModel {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub struct CourseOwner {
    pub course_id: i32,
    pub user_id: Uuid,
}
