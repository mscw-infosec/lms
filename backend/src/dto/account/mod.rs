use std::collections::HashMap;

use axum::body::Bytes;
use s3::post_policy::PresignedPost;
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
    pub avatar_url: Option<String>,
}

impl From<UserModel> for GetUserResponseDTO {
    fn from(value: UserModel) -> Self {
        Self {
            id: value.id,
            username: value.username,
            email: value.email,
            role: value.role,
            avatar_url: value.avatar_url,
        }
    }
}

#[derive(ToSchema)]
pub struct AvatarUpload {
    #[schema(value_type = String, format = Binary)]
    pub avatar: Bytes,
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
