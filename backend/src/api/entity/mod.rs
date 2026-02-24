use crate::domain::entity::service::EntityService;

use std::sync::Arc;

use axum_macros::FromRef;

use utoipa_axum::{router::OpenApiRouter, routes};

use crate::infrastructure::jwt::JWT;
pub mod routes;

#[derive(Clone, FromRef)]
pub struct EntityState {
    pub jwt: Arc<JWT>,
    pub service: EntityService,
}
pub fn configure(jwt: Arc<JWT>, service: EntityService) -> OpenApiRouter {
    let state = EntityState { jwt, service };
    OpenApiRouter::new()
        .routes(routes!(routes::create))
        .with_state(state)
}
