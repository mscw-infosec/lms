pub mod routes;
use routes::*;

use std::sync::Arc;

use axum_macros::FromRef;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{domain::rating::service::RatingService, infrastructure::jwt::JWT};

#[derive(FromRef, Clone)]
pub struct RatingState {
    pub rating_service: RatingService,
    pub jwt: Arc<JWT>,
}

pub fn configure(rating_service: RatingService, jwt: Arc<JWT>) -> OpenApiRouter {
    let state = RatingState {
        rating_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(get_my_overall))
        .routes(routes!(export_my_overall))
        .routes(routes!(get_user_overall))
        .routes(routes!(export_user_overall))
        .routes(routes!(get_course_leaderboard))
        .routes(routes!(export_course_leaderboard))
        .routes(routes!(get_my_course_rating))
        .routes(routes!(export_my_course_rating))
        .routes(routes!(get_user_course_rating))
        .routes(routes!(export_user_course_rating))
        .with_state(state)
}
