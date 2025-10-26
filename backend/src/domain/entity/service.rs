use crate::Arc;
use crate::domain::entity::model::{Entity, EntityType};
use crate::domain::entity::repository::EntityRepository;
use crate::dto::entity::UpsertEntityDto;
use crate::errors::Result;
use crate::repo;

#[derive(Clone)]
pub struct EntityService {
    repo: repo!(EntityRepository),
}

impl EntityService {
    pub fn new(repo: repo!(EntityRepository)) -> Self {
        Self { repo }
    }

    pub async fn create_entity(
        &self,
        topic_id: i32,
        r#type: EntityType,
        order_id: i32,
        entity_version: i32,
        entity_data: String,
    ) -> Result<()> {
        let dto = UpsertEntityDto {
            id: None,
            topic_id,
            r#type,
            order_id,
            entity_version,
            entity_data,
        };
        self.repo.create(dto).await
    }

    pub async fn get_by_topic_id(&self, topic_id: i32) -> Result<Vec<Entity>> {
        self.repo.get_by_topic_id(topic_id).await
    }
}
