// {
//   "access_token":"gho_16C7e42F292c6912E7710c838347Ae178B4a",
//   "scope":"repo,gist",
//   "token_type":"bearer"
// }

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct OAuthCallbackQuery {
    pub code: String,
    pub state: String,
}
