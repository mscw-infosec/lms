pub mod routes;

use std::sync::Arc;

use axum_macros::FromRef;
use routes::*;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{domain::account::service::AccountService, infrastructure::jwt::JWT};

#[derive(FromRef, Clone)]
pub struct AccountState {
    pub account_service: Arc<AccountService>,
    pub jwt: Arc<JWT>,
}

pub fn configure(account_service: Arc<AccountService>, jwt: Arc<JWT>) -> OpenApiRouter {
    let state = AccountState {
        account_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(get_user))
        .with_state(state)
}

// impl FromRef<AccountState> for Arc<JWT> {
//     fn from_ref(input: &AccountService) -> Self {
//         input.jwt.clone()
//     }
// }
//
// impl FromRef<AccountState> for Arc<AccountService> {
//     fn from_ref(input: &AccountState) -> Self {
//         input.account_service.clone()
//     }
// }
