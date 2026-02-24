use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entity::model::{Entity, EntityType};
use crate::domain::entity::repository::EntityRepository;
use crate::dto::entity::UpsertEntityDto;
use crate::errors::Result;
use crate::infrastructure::db::postgres::RepositoryPostgres;

#[async_trait]
impl EntityRepository for RepositoryPostgres {
    async fn create(&self, entity: UpsertEntityDto) -> Result<Entity> {
        let mut conn = self.pool.acquire().await?;

        let inserted = sqlx::query_as!(
            Entity,
            r#"
            INSERT INTO entities (

                topic_id,
                type,
                order_id,
                entity_version,
                entity_data
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
                id,
                topic_id,
                type AS "type: EntityType",
                order_id,
                entity_version,
                entity_data
            "#,
            entity.topic_id,
            entity.r#type as EntityType,
            entity.order_id,
            entity.entity_version,
            entity.entity_data
        )
        .fetch_one(conn.as_mut())
        .await?;

        Ok(inserted)
    }

    async fn update(&self, id: Uuid, entity: UpsertEntityDto) -> Result<Entity> {
        let mut conn = self.pool.acquire().await?;

        let updated = sqlx::query_as!(
            Entity,
            r#"
            UPDATE entities
            SET
                topic_id = $2,
                type = $3,
                order_id = $4,
                entity_version = $5,
                entity_data = $6
            WHERE id = $1
            RETURNING
                id,
                topic_id,
                type AS "type: EntityType",
                order_id,
                entity_version,
                entity_data
            "#,
            id,
            entity.topic_id,
            entity.r#type as EntityType,
            entity.order_id,
            entity.entity_version,
            entity.entity_data
        )
        .fetch_one(conn.as_mut())
        .await?;

        Ok(updated)
    }

    async fn delete(&self, id: Uuid) -> Result<()> {
        let mut conn = self.pool.acquire().await?;
        sqlx::query!(r#"DELETE FROM entities WHERE id = $1"#, id)
            .execute(conn.as_mut())
            .await?;

        Ok(())
    }

    async fn get_by_topic_id(&self, topic_id: i32) -> Result<Vec<Entity>> {
        let mut conn = self.pool.acquire().await?;

        let entities = sqlx::query_as!(
            Entity,
            r#"
            SELECT
                id,
                topic_id,
                type AS "type: EntityType",
                order_id,
                entity_version,
                entity_data
            FROM entities
            WHERE topic_id = $1
            ORDER BY order_id ASC
            "#,
            topic_id
        )
        .fetch_all(conn.as_mut())
        .await?;

        Ok(entities)
    }
}
