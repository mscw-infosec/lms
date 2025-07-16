use async_trait::async_trait;

use crate::{domain::video::model::VideoModel, errors::Result};

#[async_trait]
pub trait VideoRepository {
    async fn create(&self, video: VideoModel) -> Result<VideoModel>;
}
