pub mod routes;

use std::sync::Arc;

use axum_macros::FromRef;
use routes::*;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{domain::account::service::AccountService, infrastructure::jwt::JWT};

#[derive(FromRef, Clone)]
pub struct AccountState {
    pub account_service: AccountService,
    pub jwt: Arc<JWT>,
}

pub fn configure(account_service: AccountService, jwt: Arc<JWT>) -> OpenApiRouter {
    let state = AccountState {
        account_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(
            get_user_attributes,
            upsert_user_attributes,
            delete_user_attribute
        ))
        .routes(routes!(get_user))
        .routes(routes!(upload_avatar))
        .routes(routes!(check_ctfd))
        .with_state(state)
}
