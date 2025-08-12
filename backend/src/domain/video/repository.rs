use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;

use crate::{domain::video::model::VideoModel, errors::Result, gen_openapi::DummyRepository};

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait VideoRepository {
    async fn create(&self, video: VideoModel) -> Result<VideoModel>;
}
