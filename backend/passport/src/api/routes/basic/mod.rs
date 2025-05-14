use std::sync::Arc;

use routes::*;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    domain::{
        basic::service::BasicAuthService, 
        refresh_token::service::RefreshTokenService
    },
    infrastructure::{
        db::{
            postgres::repositories::basic_repo::BasicAuthRepositoryPostgres, 
            redis::repositories::refresh_token_repo::RefreshTokenRepositoryRedis
        }, 
        jwt::JWT,
    },
    AppState,
};

pub mod routes;

pub struct BasicAuthState {
    pub service: BasicAuthService,
    pub refresh_service: RefreshTokenService,
    pub jwt: JWT,
}

pub fn configure(state: AppState) -> OpenApiRouter {
    let basic_repo = BasicAuthRepositoryPostgres { pool: state.pool };
    let service = BasicAuthService::new(Box::new(basic_repo));
    
    let refresh_repo = RefreshTokenRepositoryRedis::new(state.rdb);
    let refresh_service = RefreshTokenService::new(Box::new(refresh_repo), state.jwt.clone());

    let state = BasicAuthState {
        service,
        refresh_service,
        jwt: state.jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(register))
        .routes(routes!(login))
        .with_state(Arc::new(state))
}
