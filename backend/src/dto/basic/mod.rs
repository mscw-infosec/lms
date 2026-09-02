use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

#[derive(Serialize, Deserialize, Validate, ToSchema)]
pub struct BasicRegisterRequest {
    #[validate(length(min = 1, max = 100, message = "Last name is required"))]
    #[schema(example = "Ivanov")]
    pub last_name: String,

    #[validate(length(min = 1, max = 100, message = "First name is required"))]
    #[schema(example = "Ivan")]
    pub first_name: String,

    #[validate(length(max = 100))]
    #[schema(example = "Ivanovich")]
    pub patronymic: Option<String>,

    #[validate(email)]
    #[schema(example = "ivan@example.com")]
    pub email: String,

    #[validate(length(min = 12, message = "Password must be at least 12 characters"))]
    #[schema(example = "Password12345")]
    pub password: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct BasicRegisterResponse {
    pub access_token: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct BasicLoginResponse {
    pub access_token: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct BasicLoginRequest {
    #[schema(example = "ivan@example.com")]
    pub email: String,
    #[schema(example = "Password12345")]
    pub password: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct VerifyEmailRequest {
    pub token: String,
}
