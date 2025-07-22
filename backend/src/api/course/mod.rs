pub mod routes;
pub mod topics;
use routes::*;
use topics::*;

use axum_macros::FromRef;
use std::sync::Arc;
use utoipa_axum::routes;

use utoipa_axum::router::OpenApiRouter;

use crate::{
    domain::{
        account::service::AccountService, courses::service::CourseService,
        topics::service::TopicService,
    },
    infrastructure::jwt::JWT,
};

#[derive(FromRef, Clone)]
pub struct CourseState {
    pub jwt: Arc<JWT>,
    pub topic_service: TopicService,
    pub course_service: CourseService,
    pub account_service: AccountService,
}

pub fn configure(
    jwt: Arc<JWT>,
    topic_service: TopicService,
    course_service: CourseService,
    account_service: AccountService,
) -> OpenApiRouter {
    let state = CourseState {
        jwt,
        topic_service,
        course_service,
        account_service,
    };

    OpenApiRouter::new()
        .routes(routes!(create_course, edit_course, delete_course))
        .routes(routes!(get_all_courses))
        .routes(routes!(get_course_by_id))
        .routes(routes!(get_all_topics_in_course))
        .with_state(state)
}
