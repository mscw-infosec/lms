use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Serialize, Deserialize, sqlx::Type, ToSchema, Debug)]
#[sqlx(type_name = "ENTITY_TYPE")]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum EntityType {
    Exam,
    Text,
    Video, // here we can add more entity types in the future
}

#[derive(Serialize, Deserialize, ToSchema, Eq, PartialEq, Ord, PartialOrd, Clone, Hash)]
#[serde(rename_all = "lowercase")]
pub enum EntityData {
    //TODO migrate exams in the future
    Text { data: String },
    Video { url: String, transcript: String },
}

impl From<String> for EntityData {
    fn from(s: String) -> Self {
        let data: EntityData =
            serde_json::from_str(s.as_str()).expect("cannot deserialize entity data");
        data
    }
}

#[derive(Serialize, FromRow, Deserialize, ToSchema)]
pub struct Entity {
    pub id: Uuid,
    pub topic_id: i32,
    pub r#type: EntityType,
    // this is not a meta-table, so we don't need to have a foreign key to external model
    //pub entity_id: Uuid,
    pub order_id: i32,
    //version for migration
    pub entity_version: i32,
    pub entity_data: EntityData,
}
