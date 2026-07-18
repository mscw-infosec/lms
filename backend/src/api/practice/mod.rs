pub mod routes;
use routes::*;

use std::sync::Arc;

use axum_macros::FromRef;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{domain::practice::service::PracticeService, infrastructure::jwt::JWT};

#[derive(FromRef, Clone)]
pub struct PracticeState {
    pub practice_service: PracticeService,
    pub jwt: Arc<JWT>,
}

pub fn configure(practice_service: PracticeService, jwt: Arc<JWT>) -> OpenApiRouter {
    let state = PracticeState {
        practice_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(create_practice))
        .routes(routes!(list_in_topic))
        .routes(routes!(get_practice, update_practice, delete_practice))
        .routes(routes!(get_practice_admin))
        .routes(routes!(create_task))
        .routes(routes!(update_task, remove_task))
        .routes(routes!(submit))
        .with_state(state)
}
