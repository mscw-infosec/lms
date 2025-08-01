mod routes;
use crate::api::exam::routes::{create, delete_exam, get_by_id, update_exam, update_exam_tasks};
use crate::domain::account::service::AccountService;
use crate::domain::exam::service::ExamService;
use crate::infrastructure::jwt::JWT;
use axum_macros::FromRef;
use routes::*;
use std::sync::Arc;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

#[derive(FromRef, Clone)]
pub struct ExamState {
    pub exam_service: ExamService,
    pub account_service: AccountService,
    pub jwt: Arc<JWT>,
}

pub fn configure(
    exam_service: ExamService,
    account_service: AccountService,
    jwt: Arc<JWT>,
) -> OpenApiRouter {
    let state = ExamState {
        exam_service,
        account_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(create, get_by_id, delete_exam, update_exam))
        .routes(routes!(update_exam_tasks))
        .with_state(state)
}
