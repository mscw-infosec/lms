use crate::domain::account::service::AccountService;
use crate::domain::task::service::TaskService;
use crate::infrastructure::jwt::JWT;
use axum_macros::FromRef;
use routes::*;
use std::sync::Arc;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
mod routes;

#[derive(FromRef, Clone)]
pub struct TaskState {
    pub task_service: TaskService,
    pub account_service: AccountService,
    pub jwt: Arc<JWT>,
}

pub fn configure(
    task_service: TaskService,
    account_service: AccountService,
    jwt: Arc<JWT>,
) -> OpenApiRouter {
    let state = TaskState {
        task_service,
        account_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(create, get_by_id, delete_task, update_task))
        .routes(routes!(get_full_by_id))
        .with_state(state)
}
