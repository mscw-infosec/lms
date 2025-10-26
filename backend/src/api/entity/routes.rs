use crate::api::entity::EntityState;

use crate::dto::entity::UpsertEntityRequestDto;
use crate::infrastructure::jwt::AccessTokenClaim;
use crate::{
    domain::account::model::UserRole,
    errors::{LMSError, Result},
};
use axum::http::StatusCode;
use axum::{Json, extract::State};

//create new entity
#[utoipa::path(
    post,
    tag = "Entity",
    path = "/new",
    request_body = UpsertEntityRequestDto,
    responses(
        (status = 201, description = "Created new Entity"),
        (status = 400, description = "Invalid request body"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "User cannot edit entities")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn create(
    claims: AccessTokenClaim,
    State(state): State<EntityState>,
    Json(payload): Json<UpsertEntityRequestDto>,
) -> Result<StatusCode> {
    if matches!(claims.role, UserRole::Student) {
        return Err(LMSError::Forbidden("You can't create entities".to_string()));
    }
    let entity_data: String = serde_json::to_string(&payload.entity_data)
        .map_err(|e| LMSError::ShitHappened(format!("Failed to serialize entity data: {e}")))?;

    state
        .service
        .create_entity(
            payload.topic_id,
            payload.r#type,
            payload.order_id,
            payload.entity_version,
            entity_data,
        )
        .await?;

    Ok(StatusCode::CREATED)
}
