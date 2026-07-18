pub mod routes;
use routes::*;

use std::sync::Arc;

use axum_macros::FromRef;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{domain::lectures::service::LectureService, infrastructure::jwt::JWT};

#[derive(FromRef, Clone)]
pub struct LectureState {
    pub lecture_service: LectureService,
    pub jwt: Arc<JWT>,
}

pub fn configure(lecture_service: LectureService, jwt: Arc<JWT>) -> OpenApiRouter {
    let state = LectureState {
        lecture_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(create))
        .routes(routes!(get_by_id, update, delete))
        .routes(routes!(list_in_topic))
        .routes(routes!(complete))
        .with_state(state)
}
