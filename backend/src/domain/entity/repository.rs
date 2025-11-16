use crate::domain::entity::model::Entity;
use crate::dto::entity::UpsertEntityDto;
use crate::errors::Result;
use crate::gen_openapi::DummyRepository;
use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;

use uuid::Uuid;

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait EntityRepository {
    async fn create(&self, entity: UpsertEntityDto) -> Result<Entity>;
    async fn update(&self, id: Uuid, entity: UpsertEntityDto) -> Result<Entity>;
    async fn delete(&self, id: Uuid) -> Result<()>;
    async fn get_by_topic_id(&self, topic_id: i32) -> Result<Vec<Entity>>;
}
