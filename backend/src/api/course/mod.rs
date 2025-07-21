pub mod routes;
use routes::*;

use axum_macros::FromRef;
use std::sync::Arc;
use utoipa_axum::routes;

use utoipa_axum::router::OpenApiRouter;

use crate::{
    domain::{account::service::AccountService, courses::service::CourseService},
    infrastructure::jwt::JWT,
};

#[derive(FromRef, Clone)]
pub struct CourseState {
    pub course_service: CourseService,
    pub account_service: AccountService,
    pub jwt: Arc<JWT>,
}

pub fn configure(
    course_service: CourseService,
    account_service: AccountService,
    jwt: Arc<JWT>,
) -> OpenApiRouter {
    let state = CourseState {
        course_service,
        account_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(create_course, edit_course, delete_course))
        .routes(routes!(get_all_courses))
        .routes(routes!(get_course_by_id))
        .with_state(state)
}
