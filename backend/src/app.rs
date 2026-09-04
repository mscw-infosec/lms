use std::sync::Arc;

use crate::{
    api,
    config::Config,
    domain::{
        account::service::AccountService, basic::service::BasicAuthService,
        courses::service::CourseService, exam::service::ExamService,
        lectures::service::LectureService, oauth::service::OAuthService,
        practice::service::PracticeService, rating::service::RatingService,
        refresh_token::service::RefreshTokenService, report::service::ReportService,
        task::service::TaskService, topics::service::TopicService, video::service::VideoService,
    },
    errors::Result,
    infrastructure::{captcha::SmartCaptchaService, jwt::JWT},
};
use axum::{http::StatusCode, routing::get};
use reqwest::Client;
use utoipa_axum::router::OpenApiRouter;

pub struct Services {
    pub account: AccountService,
    pub basic_auth: BasicAuthService,
    pub course: CourseService,
    pub exam: ExamService,
    pub lecture: LectureService,
    pub oauth: OAuthService,
    pub practice: PracticeService,
    pub rating: RatingService,
    pub report: ReportService,
    pub refresh_token: RefreshTokenService,
    pub task: TaskService,
    pub topic: TopicService,
    pub video: VideoService,
}

pub fn generate_router(
    jwt: &Arc<JWT>,
    client: Client,
    config: Config,
    svcs: Services,
) -> Result<OpenApiRouter> {
    let captcha = SmartCaptchaService::new(client.clone(), &config.smartcaptcha_server_key);

    let public = OpenApiRouter::new()
        .route("/health", get(|| async { StatusCode::OK }))
        .nest(
            "/account",
            api::account::configure(
                svcs.account.clone(),
                jwt.clone(),
                config.ctfd_auth_token.clone(),
            ),
        )
        .nest(
            "/auth",
            api::auth::configure(
                svcs.refresh_token.clone(),
                svcs.account.clone(),
                jwt.clone(),
            ),
        )
        .nest(
            "/basic",
            api::basic::configure(
                svcs.basic_auth,
                svcs.account.clone(),
                svcs.refresh_token.clone(),
                captcha,
                jwt.clone(),
            ),
        )
        .nest(
            "/oauth",
            api::oauth::configure(
                jwt.clone(),
                svcs.account.clone(),
                client,
                svcs.oauth,
                svcs.refresh_token,
                config,
            ),
        );

    let gated = OpenApiRouter::new()
        .nest(
            "/courses",
            api::course::configure(
                jwt.clone(),
                svcs.topic.clone(),
                svcs.course,
                svcs.account.clone(),
            ),
        )
        .nest(
            "/video",
            api::video::configure(svcs.video, svcs.account.clone(), jwt.clone())?,
        )
        .nest(
            "/task",
            api::task::configure(svcs.task, svcs.account.clone(), jwt.clone()),
        )
        .nest(
            "/exam",
            api::exam::configure(svcs.exam, svcs.account.clone(), jwt.clone()),
        )
        .nest(
            "/lecture",
            api::lecture::configure(svcs.lecture, jwt.clone()),
        )
        .nest(
            "/practice",
            api::practice::configure(svcs.practice, jwt.clone()),
        )
        .nest("/rating", api::rating::configure(svcs.rating, jwt.clone()))
        .nest("/report", api::report::configure(svcs.report, jwt.clone()))
        .nest(
            "/topics",
            api::topics::configure(svcs.topic, svcs.account, jwt.clone()),
        )
        .layer(axum::middleware::from_fn_with_state(
            jwt.clone(),
            api::middlewares::email_gate,
        ));

    Ok(public.merge(gated))
}
