use std::{fs::OpenOptions, io::Write, process::exit, sync::Arc};

use crate::{
    app::{generate_router, Services},
    config::Config,
    domain::{
        account::service::AccountService, basic::service::BasicAuthService,
        courses::service::CourseService, exam::service::ExamService, oauth::service::OAuthService,
        refresh_token::service::RefreshTokenService, task::service::TaskService,
        topics::service::TopicService, video::service::VideoService,
    },
    infrastructure::jwt::JWT,
};

pub struct DummyRepository;

pub fn save_openapi() -> anyhow::Result<()> {
    #[cfg(not(feature = "openapi"))]
    return Ok(());

    let client = reqwest::Client::new();
    let config = Config::default();

    let dummy = Arc::new(DummyRepository);

    let jwt = Arc::new(JWT::new(&config.jwt_secret));

    let account = AccountService::new(
        dummy.clone(),
        dummy.clone(),
        dummy.clone(),
        &config.frontend_redirect_url,
    );
    let basic_auth = BasicAuthService::new(dummy.clone());
    let course = CourseService::new(dummy.clone());
    let exam = ExamService::new(dummy.clone());
    let oauth = OAuthService::new(dummy.clone(), dummy.clone());
    let refresh_token = RefreshTokenService::new(dummy.clone(), jwt.clone());
    let task = TaskService::new(dummy.clone());
    let topic = TopicService::new(dummy.clone());
    let video = VideoService::new(dummy.clone(), config.channel_id.clone(), dummy)?;

    let services = Services {
        account,
        basic_auth,
        course,
        exam,
        oauth,
        refresh_token,
        task,
        topic,
        video,
    };

    let (_, api) = generate_router(jwt, client, config, services)?.split_for_parts();
    let spec = api.to_pretty_json()?;
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open("openapi.json")?;

    let () = file.write_all(spec.as_bytes())?;
    exit(0)
}
