use sqlx::PgPool;
use tonic::async_trait;

use crate::{
    domain::video::{model::VideoModel, repository::VideoRepository},
    errors::Result,
};

#[derive(Clone)]
pub struct VideoRepositoryPostgres {
    pub pool: PgPool,
}

#[async_trait]
impl VideoRepository for VideoRepositoryPostgres {
    async fn create(&self, video: VideoModel) -> Result<VideoModel> {
        sqlx::query!(
            r"
            INSERT INTO videos(id, url, file_size, file_name)
            VALUES ($1, $2, $3, $4)
            ",
            video.id,
            video.url,
            video.file_size,
            video.file_name
        )
        .execute(&self.pool)
        .await?;

        Ok(video)
    }
}
