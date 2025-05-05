use std::sync::Arc;

use routes::*;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    domain::basic::service::BasicAuthService,
    infrastructure::db::postgres::repositories::basic_repo::BasicAuthRepositoryPostgres, AppState,
};

pub mod routes;

pub struct BasicAuthState {
    pub service: BasicAuthService,
    pub jwt_secret: String,
}

pub fn configure(state: AppState) -> OpenApiRouter {
    let service = BasicAuthService::new(Box::new(BasicAuthRepositoryPostgres { pool: state.pool }));

    let state = BasicAuthState {
        service,
        jwt_secret: state.secret,
    };

    OpenApiRouter::new()
        .routes(routes!(register))
        .routes(routes!(login))
        .with_state(Arc::new(state))
}
