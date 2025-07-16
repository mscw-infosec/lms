pub mod routes;

use std::sync::Arc;
use utoipa_axum::routes;

use utoipa_axum::router::OpenApiRouter;

use crate::{
    AppState, domain::video::service::VideoService, errors::Result,
    infrastructure::db::postgres::repositories::video_repo::VideoRepositoryPostgres,
};

pub struct VideoState {
    pub video_service: VideoService,
}

pub async fn configure(state: AppState, channel_id: String) -> Result<OpenApiRouter> {
    let repo = Box::new(VideoRepositoryPostgres { pool: state.pool });
    let video_service = VideoService::new(repo, channel_id, state.iam).await?;

    let state = VideoState { video_service };

    let router = OpenApiRouter::new()
        .routes(routes!(routes::create))
        .with_state(Arc::new(state));

    Ok(router)
}
