pub mod routes;

use axum_macros::FromRef;
use std::sync::Arc;
use utoipa_axum::routes;

use utoipa_axum::router::OpenApiRouter;

use crate::{
    domain::{account::service::AccountService, video::service::VideoService},
    errors::Result,
    infrastructure::jwt::JWT,
};

#[derive(FromRef, Clone)]
pub struct VideoState {
    pub video_service: VideoService,
    pub account_service: AccountService,
    pub jwt: Arc<JWT>,
}

pub fn configure(
    video_service: VideoService,
    account_service: AccountService,
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
