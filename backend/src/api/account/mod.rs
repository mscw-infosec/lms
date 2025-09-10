pub mod routes;

use std::sync::Arc;

use axum_macros::FromRef;
use routes::*;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::api::middlewares::HasCtfdAuthData;
use crate::{domain::account::service::AccountService, infrastructure::jwt::JWT};

#[derive(FromRef, Clone)]
pub struct AccountState {
    pub account_service: AccountService,
    pub jwt: Arc<JWT>,
    pub ctfd_auth_token: String,
}

impl HasCtfdAuthData for AccountState {
    fn get_ctfd_auth_token(&self) -> String {
        self.ctfd_auth_token.clone()
    }
}

pub fn configure(
    account_service: AccountService,
    jwt: Arc<JWT>,
    ctfd_auth_token: String,
) -> OpenApiRouter {
    let state = AccountState {
        account_service,
        jwt,
        ctfd_auth_token,
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
        .routes(routes!(get_user_ctfd_data))
        .routes(routes!(list_accounts))
        .with_state(state)
}
