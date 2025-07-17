use async_trait::async_trait;
use dyn_clone::DynClone;

use crate::{domain::video::model::VideoModel, errors::Result};

#[async_trait]
pub trait VideoRepository: DynClone {
    async fn create(&self, video: VideoModel) -> Result<VideoModel>;
}
dyn_clone::clone_trait_object!(VideoRepository);
