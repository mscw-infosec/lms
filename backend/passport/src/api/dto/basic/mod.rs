use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

#[derive(Serialize, Deserialize, Validate, ToSchema)]
pub struct BasicRegisterRequest {
    pub username: String,

    #[validate(email)]
    pub email: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct BasicLoginRequest {
    pub username: String,
    pub password: String,
}
