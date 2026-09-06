use std::borrow::Cow;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::{Validate, ValidationError};

const USERNAME_MIN_LEN: usize = 5;
const USERNAME_MAX_LEN: usize = 32;

fn validate_username(username: &str) -> Result<(), ValidationError> {
    let username = username.trim();

    if !(USERNAME_MIN_LEN..=USERNAME_MAX_LEN).contains(&username.chars().count()) {
        return Err(
            ValidationError::new("username_length").with_message(Cow::Borrowed(
                "Username must be between 5 and 32 characters",
            )),
        );
    }

    if !username
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == ' ' || c == '_')
    {
        return Err(
            ValidationError::new("username_charset").with_message(Cow::Borrowed(
                "Username may only contain latin letters, digits, spaces and underscores",
            )),
        );
    }

    Ok(())
}

#[derive(Serialize, Deserialize, Validate, ToSchema)]
pub struct BasicRegisterRequest {
    #[validate(custom(function = "validate_username"))]
    #[schema(example = "Ivan 2077")]
    pub username: String,

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

    #[serde(default)]
    #[schema(required = true, example = "dD0xNzE...")]
    pub captcha_token: String,
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
    #[serde(default)]
    #[schema(required = true, example = "dD0xNzE...")]
    pub captcha_token: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct VerifyEmailRequest {
    pub token: String,
}

#[derive(Serialize, Deserialize, Validate, ToSchema)]
pub struct ForgotPasswordRequest {
    #[validate(email)]
    #[schema(example = "ivan@example.com")]
    pub email: String,
}

#[derive(Serialize, Deserialize, Validate, ToSchema)]
pub struct ResetPasswordRequest {
    pub token: String,
    #[validate(length(min = 12, message = "Password must be at least 12 characters"))]
    #[schema(example = "NewPassword12345")]
    pub new_password: String,
}
