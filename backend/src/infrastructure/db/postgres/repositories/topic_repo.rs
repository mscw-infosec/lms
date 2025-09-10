use crate::domain::exam::model::{Exam, ExamType};
use crate::{
    domain::topics::{model::TopicModel, repository::TopicRepository},
    dto::topics::UpsertTopicRequestDTO,
    errors::{LMSError, Result},
    infrastructure::db::postgres::RepositoryPostgres,
};
use async_trait::async_trait;

#[async_trait]
impl TopicRepository for RepositoryPostgres {
    async fn get_topic_by_id(&self, id: i32) -> Result<TopicModel> {
        let topic = sqlx::query_as!(
            TopicModel,
            r#"
                SELECT id, title, course_id, order_index
                FROM topics
                WHERE id = $1
            "#,
            id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(topic)
    }

    async fn get_all_topics_in_course(&self, course_id: i32) -> Result<Vec<TopicModel>> {
        let topics = sqlx::query_as!(
            TopicModel,
            r#"
                SELECT id, title, course_id, order_index
                FROM topics
                WHERE course_id = $1
                ORDER BY order_index
            "#,
            course_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(topics)
    }

    async fn add_topic_to_course(&self, topic: UpsertTopicRequestDTO) -> Result<()> {
        sqlx::query!(
            r#"
                INSERT INTO topics (course_id, title, order_index)
                VALUES ($1, $2, $3)
            "#,
            topic.course_id,
            topic.title,
            topic.order_index
        )
        .execute(&self.pool)
        .await
        .map_err(|err| match err {
            sqlx::Error::RowNotFound => LMSError::NotFound("Topic not found".to_string()),
            _ => err.into(),
        })?;

        Ok(())
    }

    async fn delete_topic(&self, id: i32) -> Result<()> {
        sqlx::query!(
            r#"
                DELETE FROM topics
                WHERE id = $1
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_topic(&self, id: i32, topic: UpsertTopicRequestDTO) -> Result<()> {
        sqlx::query!(
            r#"
                UPDATE topics
                SET title = $1, order_index = $2
                WHERE id = $3
            "#,
            topic.title,
            topic.order_index,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_exams(&self, id: i32) -> Result<Vec<Exam>> {
        let exams = sqlx::query_as!(
            Exam,
            r#"
                SELECT id, topic_id, tries_count, duration, type as "type: ExamType", description, name, starts_at, ends_at
                FROM exams
                WHERE topic_id = $1
            "#,
            id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(exams)
    }
}
