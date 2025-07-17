use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::domain::account::model::{UserModel, UserRole};

#[derive(Serialize, ToSchema)]
pub struct GetUserResponseDTO {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: UserRole,
}

impl From<UserModel> for GetUserResponseDTO {
    fn from(value: UserModel) -> Self {
        Self {
            id: value.id,
            username: value.username,
            email: value.email,
            role: value.role,
        }
    }
}
