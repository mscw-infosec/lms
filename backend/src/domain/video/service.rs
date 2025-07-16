use prost::Message;
use yandex_cloud::{
    AuthInterceptor,
    tonic_exports::{Channel, Endpoint},
    yandex::cloud::{
        operation::operation,
        video::v1::{
            AutoTranscode, CreateVideoRequest, Video, VideoSignUrlAccessParams, VideoTusdParams,
            VideoTusdSource,
            create_video_request::{self, AccessRights},
            video::Source,
            video_service_client::VideoServiceClient,
        },
    },
};

use crate::{
    api::dto::video::CreateVideoRequestDTO,
    domain::video::{model::VideoModel, repository::VideoRepository},
    errors::{LMSError, Result},
    infrastructure::iam::IAMTokenManager,
};

pub struct VideoService {
    repo: Box<dyn VideoRepository + Send + Sync>,
    channel: Channel,
    channel_id: String,
    token_manager: IAMTokenManager,
}

impl VideoService {
    pub async fn new(
        repo: Box<dyn VideoRepository + Send + Sync>,
        channel_id: String,
        token_manager: IAMTokenManager,
    ) -> Result<Self> {
        let channel = Endpoint::from_static("https://video.api.cloud.yandex.net")
            .connect()
            .await
            // TODO: think about degradation
            .expect("TODO: think about degradation");

        let service = Self {
            repo,
            channel,
            channel_id,
            token_manager,
        };

        Ok(service)
    }

    pub async fn create(&self, video: CreateVideoRequestDTO) -> Result<VideoModel> {
        let token = self
            .token_manager
            .get_token()
            .await
            .map_err(|e| LMSError::ShitHappened(format!("Failed to get IAM token: {e}")))?;

        let auth = AuthInterceptor::new(token);
        let mut client = VideoServiceClient::with_interceptor(self.channel.clone(), auth);

        let request = CreateVideoRequest {
            channel_id: self.channel_id.clone(),
            title: video.name.clone(),
            auto_transcode: AutoTranscode::Enable.into(),
            auto_publish: Some(true),
            enable_ad: Some(false),
            access_rights: Some(AccessRights::SignUrlAccess(VideoSignUrlAccessParams {})),
            source: Some(create_video_request::Source::Tusd(VideoTusdParams {
                file_size: video.size,
                file_name: video.name.clone(),
            })),
            ..Default::default()
        };

        let response = client
            .create(request)
            .await
            .map_err(LMSError::GRPCError)?
            .into_inner();

        let any = match response.result {
            Some(operation::Result::Error(status)) => {
                return Err(LMSError::ShitHappened(format!(
                    "Recieved error status from Yandex - {status:?}"
                )));
            }
            Some(operation::Result::Response(any)) => any,
            None => {
                return Err(LMSError::ShitHappened(
                    "No result in Yandex Cloud video create response".to_string(),
                ));
            }
        };

        let video_proto = Video::decode(any.value.as_slice())
            .map_err(|e| LMSError::ShitHappened(format!("Failed to decode Video protobuf: {e}")))?;

        let id = video_proto.id;
        let file_name = video_proto.title;

        let Some(Source::Tusd(VideoTusdSource { url, file_size })) = video_proto.source else {
            return Err(LMSError::ShitHappened(
                "No source in Video protobuf".to_string(),
            ));
        };

        let model = VideoModel {
            id,
            url,
            file_size,
            file_name,
        };

        // TODO: also, i probably should do something, if insertion failed, but Im to tired rn
        let model = self.repo.create(model).await?;

        Ok(model)
    }
}
