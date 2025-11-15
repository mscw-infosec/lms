use std::{fs::OpenOptions, io::Write, process::exit, sync::Arc};

use crate::{
    app::{Services, generate_router},
    config::Config,
    domain::{
        account::service::AccountService, basic::service::BasicAuthService,
        courses::service::CourseService, exam::service::ExamService, oauth::service::OAuthService,
        refresh_token::service::RefreshTokenService, task::service::TaskService,
        topics::service::TopicService, video::service::VideoService,
    },
    infrastructure::jwt::JWT,
};

#[allow(dead_code)]
pub struct DummyRepository;

#[allow(dead_code)]
pub fn save_openapi() {
    let client = reqwest::Client::new();
    let config = Config::default();

    let dummy = Arc::new(DummyRepository);

    let jwt = Arc::new(JWT::new(&config.jwt_secret));

    let account = AccountService::new(
        dummy.clone(),
        dummy.clone(),
        dummy.clone(),
        &config.frontend_redirect_url,
        client.clone(),
        config.ctfd_token.clone(),
        config.sirius_token.clone()
    );
    let basic_auth = BasicAuthService::new(dummy.clone());
    let course = CourseService::new(dummy.clone(), account.clone());
    let topic = TopicService::new(dummy.clone(), course.clone());
    let exam = ExamService::new(
        dummy.clone(),
        client.clone(),
        config.ctfd_token.clone(),
        topic.clone(),
    );
    let oauth = OAuthService::new(dummy.clone(), dummy.clone());
    let refresh_token = RefreshTokenService::new(dummy.clone(), jwt.clone());
    let task = TaskService::new(dummy.clone(), client.clone(), config.ctfd_token.clone());
    let video = VideoService::new(dummy.clone(), config.channel_id.clone(), dummy)
        .expect("Failed to create VideoService");

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

    let (_, api) = generate_router(jwt, client, config, services)
        .expect("Failed to generate app router")
        .split_for_parts();

    let spec = api
        .to_pretty_json()
        .expect("Failed to convert OpenAPI struct to json");

    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open("openapi.json")
        .expect("Failed to open file");

    let () = file
        .write_all(spec.as_bytes())
        .expect("Failed to write to file");

    drop(file);

    exit(0)
}
