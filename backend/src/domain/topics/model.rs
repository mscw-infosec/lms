use sqlx::prelude::FromRow;

#[derive(FromRow)]
pub struct TopicModel {
    pub id: i32,
    pub course_id: i32,
    pub title: String,
    pub order_index: i32,
}
