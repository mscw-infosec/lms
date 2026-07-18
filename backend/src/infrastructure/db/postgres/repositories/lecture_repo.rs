use crate::{
    domain::lectures::{
        model::{LectureModel, TopicLectureModel},
        repository::LectureRepository,
    },
    dto::lectures::{CreateLectureRequestDTO, UpdateLectureRequestDTO},
    errors::{LMSError, Result},
    infrastructure::db::postgres::RepositoryPostgres,
};
use async_trait::async_trait;
use uuid::Uuid;

#[async_trait]
impl LectureRepository for RepositoryPostgres {
    async fn create(&self, lecture: CreateLectureRequestDTO) -> Result<LectureModel> {
        let mut tx = self.pool.begin().await?;

        let created = sqlx::query_as!(
            LectureModel,
            r#"
                INSERT INTO lectures (title, description, content, video_id)
                VALUES ($1, $2, $3, $4)
                RETURNING id, title, description, content, video_id
            "#,
            lecture.title,
            lecture.description,
            lecture.content,
            lecture.video_id
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(ref e) if e.constraint().is_some() => {
                LMSError::NotFound("Referenced video not found".to_string())
            }
            _ => err.into(),
        })?;

        sqlx::query!(
            r#"
                INSERT INTO lecture_links (topic_id, lecture_id, order_index)
                VALUES ($1, $2, $3)
            "#,
            lecture.topic_id,
            created.id,
            lecture.order_index
        )
        .execute(&mut *tx)
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(ref e) if e.constraint().is_some() => {
                LMSError::NotFound("Topic not found".to_string())
            }
            _ => err.into(),
        })?;

        tx.commit().await?;

        Ok(created)
    }

    async fn get(&self, id: i32) -> Result<LectureModel> {
        let lecture = sqlx::query_as!(
            LectureModel,
            r#"
                SELECT id, title, description, content, video_id
                FROM lectures
                WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| LMSError::NotFound("Lecture not found".to_string()))?;

        Ok(lecture)
    }

    async fn get_topic_id(&self, lecture_id: i32) -> Result<i32> {
        let topic_id = sqlx::query_scalar!(
            r#"
                SELECT topic_id
                FROM lecture_links
                WHERE lecture_id = $1
            "#,
            lecture_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| LMSError::NotFound("Lecture not found".to_string()))?;

        Ok(topic_id)
    }

    async fn list_in_topic(&self, topic_id: i32, user_id: Uuid) -> Result<Vec<TopicLectureModel>> {
        let lectures = sqlx::query_as!(
            TopicLectureModel,
            r#"
                SELECT l.id,
                       l.title,
                       l.description,
                       l.video_id,
                       ll.order_index,
                       (lp.user_id IS NOT NULL) AS "completed!"
                FROM lecture_links ll
                    JOIN lectures l ON l.id = ll.lecture_id
                    LEFT JOIN lecture_progress lp
                        ON lp.lecture_id = l.id AND lp.user_id = $2
                WHERE ll.topic_id = $1
                ORDER BY ll.order_index
            "#,
            topic_id,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(lectures)
    }

    async fn update(&self, id: i32, lecture: UpdateLectureRequestDTO) -> Result<LectureModel> {
        let mut tx = self.pool.begin().await?;

        let updated = sqlx::query_as!(
            LectureModel,
            r#"
                UPDATE lectures
                SET title = $1, description = $2, content = $3, video_id = $4
                WHERE id = $5
                RETURNING id, title, description, content, video_id
            "#,
            lecture.title,
            lecture.description,
            lecture.content,
            lecture.video_id,
            id
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(ref e) if e.constraint().is_some() => {
                LMSError::NotFound("Referenced video not found".to_string())
            }
            _ => err.into(),
        })?
        .ok_or_else(|| LMSError::NotFound("Lecture not found".to_string()))?;

        sqlx::query!(
            r#"
                UPDATE lecture_links
                SET order_index = $1
                WHERE lecture_id = $2
            "#,
            lecture.order_index,
            id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(updated)
    }

    async fn delete(&self, id: i32) -> Result<()> {
        sqlx::query!(
            r#"
                DELETE FROM lectures
                WHERE id = $1
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn is_completed(&self, user_id: Uuid, lecture_id: i32) -> Result<bool> {
        let exists = sqlx::query_scalar!(
            r#"
                SELECT EXISTS(
                    SELECT 1 FROM lecture_progress
                    WHERE user_id = $1 AND lecture_id = $2
                ) AS "exists!"
            "#,
            user_id,
            lecture_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(exists)
    }

    async fn mark_completed(&self, user_id: Uuid, lecture_id: i32) -> Result<()> {
        sqlx::query!(
            r#"
                INSERT INTO lecture_progress (user_id, lecture_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, lecture_id) DO NOTHING
            "#,
            user_id,
            lecture_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
