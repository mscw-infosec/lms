pub mod routes;

use std::sync::Arc;

use routes::*;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    domain::account::service::AccountService,
    infrastructure::{
        db::postgres::repositories::account_repo::AccountRepositoryPostgres, jwt::JWT,
    },
    AppState,
};

pub struct AccountState {
    pub service: AccountService,
    pub jwt: JWT,
}

pub fn configure(state: AppState) -> OpenApiRouter {
    let service = AccountService::new(Box::new(AccountRepositoryPostgres { pool: state.pool }));

    let state = AccountState {
        service,
        jwt: state.jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(get_user))
        .with_state(Arc::new(state))
}
