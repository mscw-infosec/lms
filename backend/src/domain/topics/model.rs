use sqlx::prelude::FromRow;

#[derive(FromRow)]
pub struct TopicModel {
    pub id: i32,
    pub course_id: i32,
    pub title: String,
    pub order_index: i32,
}

/// One item of a topic's unified, ordered content list. `kind` is one of
/// `lecture` / `practice` / `exam` / `text`; `content` is only populated for
/// text items.
#[derive(FromRow)]
pub struct TopicContentRow {
    pub kind: String,
    pub item_id: String,
    pub title: String,
    pub content: Option<String>,
    pub order_index: i32,
}
