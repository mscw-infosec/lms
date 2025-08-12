use prost::Message;
use prost_types::Duration;
use std::sync::Arc;
use yandex_cloud::{
    AuthInterceptor,
    tonic_exports::{Channel, Endpoint},
    yandex::cloud::{
        operation::operation,
        video::v1::{
            AutoTranscode, CreateVideoRequest, GetVideoPlayerUrlRequest, Video, VideoPlayerParams,
            VideoSignUrlAccessParams, VideoTusdParams, VideoTusdSource,
            create_video_request::{self, AccessRights},
            video::Source,
            video_service_client::VideoServiceClient,
        },
    },
};

use crate::{
    domain::video::{model::VideoModel, repository::VideoRepository},
    dto::video::CreateVideoRequestDTO,
    errors::{LMSError, Result},
    infrastructure::iam::IAMManager,
    repo,
};

pub const SIGNED_URL_EXPIRATION_DURATION: i64 = 5 * 60 * 60;

#[derive(Clone)]
pub struct VideoService {
    repo: repo!(VideoRepository),
    channel: Channel,
    channel_id: String,
    token_manager: repo!(IAMManager),
}

impl VideoService {
    pub fn new(
        repo: repo!(VideoRepository),
        channel_id: String,
        token_manager: repo!(IAMManager),
    ) -> Result<Self> {
        let channel = Endpoint::from_static("https://video.api.cloud.yandex.net").connect_lazy();

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

    pub async fn get_player_url(&self, video_id: String) -> Result<String> {
        let token = self
            .token_manager
            .get_token()
            .await
            .map_err(|e| LMSError::ShitHappened(format!("Failed to get IAM token: {e}")))?;

        let auth = AuthInterceptor::new(token);
        let mut client = VideoServiceClient::with_interceptor(self.channel.clone(), auth);

        let request = GetVideoPlayerUrlRequest {
            video_id,
            params: Some(VideoPlayerParams {
                mute: false,
                autoplay: false,
                hidden: false,
            }),
            signed_url_expiration_duration: Some(Duration {
                seconds: SIGNED_URL_EXPIRATION_DURATION,
                nanos: 0,
            }),
        };

        let response = client.get_player_url(request).await?.into_inner();

        Ok(response.player_url)
    }
}
