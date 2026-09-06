use std::{fs::OpenOptions, io::Write, process::exit, sync::Arc};

use crate::{
    app::{Services, generate_router},
    config::Config,
    domain::{
        account::service::AccountService, basic::service::BasicAuthService,
        courses::service::CourseService, exam::service::ExamService,
        lectures::service::LectureService, oauth::service::OAuthService,
        practice::service::PracticeService, rating::service::RatingService,
        refresh_token::service::RefreshTokenService, report::service::ReportService,
        sso::service::SsoService, task::service::TaskService, topics::service::TopicService,
        video::service::VideoService,
    },
    infrastructure::{email::EmailService, jwt::JWT, sso_keys::SsoKeys},
};

#[allow(dead_code)]
pub struct DummyRepository;

#[allow(dead_code)]
pub fn save_openapi() {
    let client = reqwest::Client::new();
    let config = Config {
        smtp_from: "noreply@example.com".to_string(),
        ..Default::default()
    };

    let dummy = Arc::new(DummyRepository);

    let jwt = Arc::new(JWT::new(&config.jwt_secret));
    let email = EmailService::new(&config).expect("Failed to build dummy EmailService");

    let account = AccountService::new(
        dummy.clone(),
        dummy.clone(),
        dummy.clone(),
        email.clone(),
        dummy.clone(),
        &config.frontend_redirect_url,
        client.clone(),
        config.ctfd_token.clone(),
    );
    let basic_auth = BasicAuthService::new(dummy.clone(), dummy.clone(), email);
    let course = CourseService::new(dummy.clone(), account.clone());
    let topic = TopicService::new(dummy.clone(), course.clone());
    let exam = ExamService::new(
        dummy.clone(),
        client.clone(),
        config.ctfd_token.clone(),
        topic.clone(),
    );
    let lecture = LectureService::new(dummy.clone(), topic.clone());
    let oauth = OAuthService::new(dummy.clone(), dummy.clone());
    let refresh_token = RefreshTokenService::new(dummy.clone(), jwt.clone());
    let task = TaskService::new(dummy.clone(), client.clone(), config.ctfd_token.clone());
    let practice = PracticeService::new(dummy.clone(), task.clone(), topic.clone());
    let report = ReportService::new(exam.clone(), dummy.clone());
    let rating = RatingService::new(course.clone(), dummy.clone());
    let video = VideoService::new(dummy.clone(), config.channel_id.clone(), dummy.clone())
        .expect("Failed to create VideoService");
    let sso = SsoService::new(
        dummy.clone(),
        dummy,
        account.clone(),
        Arc::new(SsoKeys::generate_ephemeral().expect("Failed to generate dummy SSO key")),
        &config.sso_issuer,
        &config.frontend_base_url,
        &format!("{}/{}", config.s3_endpoint, config.s3_bucket_name),
    );

    let services = Services {
        account,
        basic_auth,
        course,
        exam,
        lecture,
        oauth,
        practice,
        rating,
        report,
        refresh_token,
        sso,
        task,
        topic,
        video,
    };

    let (_, api) = generate_router(&jwt, client, config, services)
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
