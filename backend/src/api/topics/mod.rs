pub mod routes;
use routes::*;

use std::sync::Arc;

use axum_macros::FromRef;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    domain::{account::service::AccountService, topics::service::TopicService},
    infrastructure::jwt::JWT,
};

#[derive(FromRef, Clone)]
pub struct TopicsState {
    pub topic_service: TopicService,
    pub account_service: AccountService,
    pub jwt: Arc<JWT>,
}

pub fn configure(
    topics_service: TopicService,
    account_service: AccountService,
    jwt: Arc<JWT>,
) -> OpenApiRouter {
    let state = TopicsState {
        topic_service: topics_service,
        account_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(
            get_topic_by_id,
            delete_topic,
            update_topic,
            add_topic_to_course
        ))
        .routes(routes!(get_exams))
        .with_state(state)
}
