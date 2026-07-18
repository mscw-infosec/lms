pub mod routes;
use routes::*;

use std::sync::Arc;

use axum_macros::FromRef;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{domain::report::service::ReportService, infrastructure::jwt::JWT};

#[derive(FromRef, Clone)]
pub struct ReportState {
    pub report_service: ReportService,
    pub jwt: Arc<JWT>,
}

pub fn configure(report_service: ReportService, jwt: Arc<JWT>) -> OpenApiRouter {
    let state = ReportState {
        report_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(get_exam_gradebook))
        .routes(routes!(export_exam_results))
        .with_state(state)
}
