pub mod routes;

use axum::extract::FromRef;
use std::sync::Arc;
use utoipa_axum::routes;

use utoipa_axum::router::OpenApiRouter;

use crate::{
    domain::{account::service::AccountService, video::service::VideoService},
    errors::Result,
    infrastructure::jwt::JWT,
};

#[derive(Clone)]
pub struct VideoState {
    pub video_service: Arc<VideoService>,
    pub account_service: Arc<AccountService>,
    pub jwt: Arc<JWT>,
}

pub fn configure(
    video_service: Arc<VideoService>,
    account_service: Arc<AccountService>,
    jwt: Arc<JWT>,
) -> Result<OpenApiRouter> {
    let state = VideoState {
        video_service,
        account_service,
        jwt,
    };

    let router = OpenApiRouter::new()
        .routes(routes!(routes::create))
        .routes(routes!(routes::get_video_url))
        .with_state(state);

    Ok(router)
}

impl FromRef<VideoState> for Arc<JWT> {
    fn from_ref(input: &VideoState) -> Self {
        input.jwt.clone()
    }
}

impl FromRef<VideoState> for Arc<AccountService> {
    fn from_ref(input: &VideoState) -> Self {
        input.account_service.clone()
    }
}
