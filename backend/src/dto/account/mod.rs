use std::collections::HashMap;

use s3::post_policy::PresignedPost;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::domain::account::model::{Attributes, UserModel, UserRole};

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UpdateUserRoleDTO {
    pub role: UserRole,
}

#[derive(Serialize, ToSchema)]
pub struct GetUserResponseDTO {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: UserRole,
}

#[derive(Serialize, ToSchema)]
pub struct PublicAccountDTO {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: UserRole,
    pub attributes: Attributes,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct CtfdStatus {
    pub status: bool,
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

impl From<UserModel> for PublicAccountDTO {
    fn from(value: UserModel) -> Self {
        Self {
            id: value.id,
            username: value.username,
            email: value.email,
            role: value.role,
            attributes: value.attributes,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct AvatarUploadResponse {
    pub url: String,
    pub fields: HashMap<String, String>,
}

impl From<PresignedPost> for AvatarUploadResponse {
    fn from(value: PresignedPost) -> Self {
        Self {
            url: value.url,
            fields: value.fields,
        }
    }
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct CtfdAccountData {
    pub attributes: Attributes,
    pub active_attempt_task_ids: Vec<usize>,
}

pub struct CtfdToken {
    pub token: String,
}
