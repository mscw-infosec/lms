use crate::domain::exam::model::{Exam, ExamType};
use crate::{
    domain::topics::{
        model::{TopicContentRow, TopicModel},
        repository::TopicRepository,
    },
    dto::topics::UpsertTopicRequestDTO,
    errors::{LMSError, Result},
    infrastructure::db::postgres::RepositoryPostgres,
};
use async_trait::async_trait;
use uuid::Uuid;

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

    async fn get_topic_content(&self, topic_id: i32) -> Result<Vec<TopicContentRow>> {
        let rows = sqlx::query_as!(
            TopicContentRow,
            r#"
                SELECT 'lecture'      AS "kind!",
                       l.id::text     AS "item_id!",
                       l.title        AS "title!",
                       NULL::text     AS "content?",
                       ll.order_index AS "order_index!"
                FROM lecture_links ll
                    JOIN lectures l ON l.id = ll.lecture_id
                WHERE ll.topic_id = $1
                UNION ALL
                SELECT 'practice', p.id::text, p.title, NULL::text, p.order_index
                FROM practices p
                WHERE p.topic_id = $1
                UNION ALL
                SELECT 'exam', e.id::text, e.name, NULL::text, eo.order_index
                FROM exam_ordering eo
                    JOIN exams e ON e.id = eo.exam_id
                WHERE eo.topic_id = $1
                UNION ALL
                SELECT 'text', tt.id::text, LEFT(tt.content, 60), tt.content, tt.order_index
                FROM topic_texts tt
                WHERE tt.topic_id = $1
                ORDER BY "order_index!"
            "#,
            topic_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    #[allow(clippy::cast_possible_truncation, clippy::cast_possible_wrap)]
    async fn reorder_topic_content(&self, topic_id: i32, items: &[(String, String)]) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        // exam_ordering has UNIQUE(topic_id, order_index); bump exams out of the
        // way first so reassignment can't transiently collide.
        sqlx::query!(
            "UPDATE exam_ordering SET order_index = order_index + 1000000 WHERE topic_id = $1",
            topic_id
        )
        .execute(&mut *tx)
        .await?;

        let bad_id = || LMSError::ShitHappened("Invalid item id in reorder".to_string());

        for (i, (kind, id)) in items.iter().enumerate() {
            let order = i as i32;
            match kind.as_str() {
                "lecture" => {
                    let lid: i32 = id.parse().map_err(|_| bad_id())?;
                    sqlx::query!(
                        "UPDATE lecture_links SET order_index = $1 WHERE topic_id = $2 AND lecture_id = $3",
                        order, topic_id, lid
                    ).execute(&mut *tx).await?;
                }
                "practice" => {
                    let pid: i32 = id.parse().map_err(|_| bad_id())?;
                    sqlx::query!(
                        "UPDATE practices SET order_index = $1 WHERE id = $2 AND topic_id = $3",
                        order,
                        pid,
                        topic_id
                    )
                    .execute(&mut *tx)
                    .await?;
                }
                "exam" => {
                    let eid: Uuid = id.parse().map_err(|_| bad_id())?;
                    sqlx::query!(
                        "UPDATE exam_ordering SET order_index = $1 WHERE topic_id = $2 AND exam_id = $3",
                        order, topic_id, eid
                    ).execute(&mut *tx).await?;
                }
                "text" => {
                    let tid: i32 = id.parse().map_err(|_| bad_id())?;
                    sqlx::query!(
                        "UPDATE topic_texts SET order_index = $1 WHERE id = $2 AND topic_id = $3",
                        order,
                        tid,
                        topic_id
                    )
                    .execute(&mut *tx)
                    .await?;
                }
                _ => return Err(LMSError::ShitHappened("Unknown item kind".to_string())),
            }
        }

        tx.commit().await?;
        Ok(())
    }

    async fn create_topic_text(&self, topic_id: i32, content: String) -> Result<i32> {
        let order_index = self.next_topic_order(topic_id).await?;
        let id = sqlx::query_scalar!(
            r#"
                INSERT INTO topic_texts (topic_id, content, order_index)
                VALUES ($1, $2, $3)
                RETURNING id
            "#,
            topic_id,
            content,
            order_index
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(ref e) if e.is_foreign_key_violation() => {
                LMSError::NotFound("Topic not found".to_string())
            }
            _ => err.into(),
        })?;

        Ok(id)
    }

    async fn update_topic_text(&self, topic_id: i32, text_id: i32, content: String) -> Result<()> {
        sqlx::query!(
            r#"
                UPDATE topic_texts
                SET content = $1
                WHERE id = $2 AND topic_id = $3
            "#,
            content,
            text_id,
            topic_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn delete_topic_text(&self, topic_id: i32, text_id: i32) -> Result<()> {
        sqlx::query!(
            r#"
                DELETE FROM topic_texts
                WHERE id = $1 AND topic_id = $2
            "#,
            text_id,
            topic_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
