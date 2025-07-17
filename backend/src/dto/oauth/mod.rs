use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct OAuthCallbackQuery {
    pub code: String,
    pub state: String,
}
