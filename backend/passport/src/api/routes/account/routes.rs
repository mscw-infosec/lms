use std::sync::Arc;

use axum::{extract::State, http::HeaderMap, Json};

use crate::{
    domain::account::model::User, errors::LMSError, infrastructure::jwt::claim_from_header,
};

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
        ("bearerAuth" = [])
    ),
)]
pub async fn get_user(
    header: HeaderMap,
    State(state): State<Arc<AccountState>>,
) -> Result<Json<User>, LMSError> {
    let id = claim_from_header(&header, &state.jwt_secret)?.id;
    let user = state.service.get_user(id).await?;
    Ok(Json(user))
}
