use std::sync::Arc;

use crate::{domain::account::model::User, errors::LMSError};
use axum::{Json, extract::State, http::HeaderMap};

use super::AccountState;

/// Return user object
#[utoipa::path(
    get,
    path = "/",
    tag = "Account",
    responses(
        (status = 200, body = User),
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn get_user(
    header: HeaderMap,
    State(state): State<Arc<AccountState>>,
) -> Result<Json<User>, LMSError> {
    let id = state.jwt.access_from_header(&header)?.sub;
    let user = state.service.get_user(id).await?;
    Ok(Json(user))
}
