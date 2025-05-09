use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::domain::basic::model::BasicUser;

#[derive(Serialize, Deserialize, Validate, ToSchema)]
pub struct BasicRegisterRequest {
    #[schema(example = "John Doe")]
    pub username: String,

    #[validate(email)]
    #[schema(example = "john@example.com")]
    pub email: String,

    #[schema(example = "Password123")]
    pub password: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct BasicRegisterResponse {
    pub user: BasicUser,
    pub access_token: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct BasicLoginRequest {
    #[schema(example = "John Doe")]
    pub username: String,
    #[schema(example = "Password123")]
    pub password: String,
}
