mod attempt;
mod routes;

use crate::api::exam::attempt::{
    get_last_attempt, get_self_exam_attempts, patch_attempt, start_new_attempt, stop_attempt,
};
use crate::api::exam::routes::{create, delete_exam, get_by_id, update_exam, update_exam_entities};
use crate::domain::account::service::AccountService;
use crate::domain::exam::service::ExamService;
use crate::infrastructure::jwt::JWT;
use attempt::*;
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
        .routes(routes!(update_exam_entities, start_new_attempt))
        .routes(routes!(stop_attempt, patch_attempt, get_last_attempt))
        .routes(routes!(get_entities))
        .routes(routes!(get_self_exam_attempts))
        .routes(routes!(create_text, update_text, delete_text))
        .routes(routes!(get_attempts_by_exam, patch_attempt_task_verdict))
        .routes(routes!(change_visibility_for_attempt_by_id))
        .routes(routes!(change_visibility_for_attempts_by_exam))
        .routes(routes!(score_unscored))
        .with_state(state)
}
