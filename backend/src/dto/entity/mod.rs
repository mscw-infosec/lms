use crate::domain::entity::model::Entity;
use crate::domain::entity::model::EntityData;
use crate::domain::entity::model::EntityType;

use serde::Deserialize;
use serde::Serialize;

use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;
#[derive(Serialize, FromRow)]
pub struct UpsertEntityDto {
    pub id: Option<Uuid>,
    pub topic_id: i32,
    pub r#type: EntityType,
    pub order_id: i32,
    pub entity_version: i32,
    pub entity_data: String,
}

#[derive(ToSchema, Serialize, Deserialize)]
pub struct UpsertEntityRequestDto {
    pub topic_id: i32,
    pub r#type: EntityType,
    pub order_id: i32,
    pub entity_version: i32,
    pub entity_data: EntityData,
}

#[derive(Serialize, ToSchema)]
pub struct GetEntitiesForTopicResponseDto {
    pub entities: Vec<Entity>,
}
