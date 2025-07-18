use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct OAuthCallbackQuery {
    pub code: String,
    pub state: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct OAuthResponse {
    pub access_token: String,
}
