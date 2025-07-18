use crate::{
    domain::account::model::UserModel, dto::account::GetUserResponseDTO, errors::LMSError,
};
use axum::Json;

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
pub async fn get_user(user: UserModel) -> Result<Json<GetUserResponseDTO>, LMSError> {
    Ok(Json(user.into()))
}
