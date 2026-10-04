pub mod routes;
use routes::*;

use std::sync::Arc;

use axum_macros::FromRef;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{domain::attachments::service::AttachmentService, infrastructure::jwt::JWT};

#[derive(FromRef, Clone)]
pub struct AttachmentState {
    pub attachment_service: AttachmentService,
    pub jwt: Arc<JWT>,
}

pub fn configure(attachment_service: AttachmentService, jwt: Arc<JWT>) -> OpenApiRouter {
    let state = AttachmentState {
        attachment_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(list_lecture, upload_lecture))
        .routes(routes!(list_task, upload_task))
        .routes(routes!(complete_upload))
        .routes(routes!(download))
        .routes(routes!(delete))
        .with_state(state)
}
