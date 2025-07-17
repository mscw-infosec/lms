use crate::{dto::account::GetUserResponseDTO, errors::LMSError};
use axum::{Json, extract::State, http::HeaderMap};

use super::AccountState;

/// Return user object
#[utoipa::path(
    get,
    path = "/",
    tag = "Account",
    responses(
        (status = 200, body = GetUserResponseDTO),
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn get_user(
    header: HeaderMap,
    State(state): State<AccountState>,
) -> Result<Json<GetUserResponseDTO>, LMSError> {
    let id = state.jwt.access_from_header(&header)?.sub;
    let user = state.account_service.get_user(id).await?.into();
    Ok(Json(user))
}
