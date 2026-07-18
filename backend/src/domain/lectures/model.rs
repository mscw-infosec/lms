use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use utoipa::ToSchema;

/// A lecture as stored in the `lectures` table. Topic membership and ordering
/// live in `lecture_links`.
#[derive(FromRow, Serialize, Deserialize, ToSchema, Debug)]
pub struct LectureModel {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub video_id: Option<String>,
}

/// A lecture as seen inside a topic listing: lighter than [`LectureModel`]
/// (no full `content` body) and carries the per-topic order plus the requesting
/// user's completion state.
#[derive(FromRow, Serialize, Deserialize, ToSchema, Debug)]
pub struct TopicLectureModel {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub video_id: Option<String>,
    pub order_index: i32,
    pub completed: bool,
}
