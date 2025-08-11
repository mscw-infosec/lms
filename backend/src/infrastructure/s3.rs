use std::{borrow::Cow, sync::Arc};

use async_trait::async_trait;
use axum::http::HeaderValue;
use futures::StreamExt;
use impl_unimplemented::impl_unimplemented;
use s3::{
    creds::Credentials, error::S3Error, post_policy::PresignedPost, Bucket, BucketConfiguration,
    PostPolicy, PostPolicyField, PostPolicyValue, Region,
};
use tokio_util::io::StreamReader;
use tracing::warn;

use crate::{config::Config, errors::LMSError, gen_openapi::DummyRepository};

#[impl_unimplemented]
#[async_trait]
pub trait S3 {
    async fn presign_post(&self, path: &str) -> Result<PresignedPost, S3Error>;
    async fn save_from_url(&self, path: &str, url: &str) -> Result<(), LMSError>;
}

#[derive(Clone)]
pub struct S3Manager {
    bucket: Arc<Bucket>,
    client: reqwest::Client,
}

impl S3Manager {
    pub async fn new(config: Config, client: reqwest::Client) -> anyhow::Result<Self> {
        let bucket_name = config.s3_bucket_name;
        let region = Region::Yandex;
        let credentials = Credentials::default()?;

        let mut bucket =
            Bucket::new(&bucket_name, region.clone(), credentials.clone())?.with_path_style();

        if !bucket.exists().await? {
            bucket = Bucket::create_with_path_style(
                &bucket_name,
                region,
                credentials,
                BucketConfiguration::default(),
            )
            .await?
            .bucket;
        }

        let manager = Self {
            bucket: bucket.into(),
            client,
        };

        Ok(manager)
    }
}

#[async_trait]
impl S3 for S3Manager {
    async fn presign_post(&self, path: &str) -> Result<PresignedPost, S3Error> {
        let post_policy = PostPolicy::new(60 * 60)
            .condition(
                PostPolicyField::Key,
                PostPolicyValue::Exact(Cow::from(path)),
            )?
            .condition(
                PostPolicyField::ContentType,
                PostPolicyValue::StartsWith(Cow::from("image/")),
            )?
            .condition(
                PostPolicyField::ContentLengthRange,
                PostPolicyValue::Range(0, 5_242_880), // 5MB
            )?;

        self.bucket.presign_post(post_policy).await
    }

    async fn save_from_url(&self, path: &str, url: &str) -> Result<(), LMSError> {
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| LMSError::ShitHappened(format!("Failed to send a request - {e:?}")))?;

        if !response.status().is_success() {
            warn!("Failed to download avatar from {url}");
            return Err(LMSError::ShitHappened(format!(
                "Failed to download avatar from {url}"
            )));
        }

        let content_type = response
            .headers()
            .get("Content-Type")
            .unwrap_or(&HeaderValue::from_static("image/jpeg"))
            .to_str()
            .map_or_else(|_| "image/jpeg".to_string(), String::from);

        let stream = response
            .bytes_stream()
            .map(|res| res.map_err(std::io::Error::other));

        let mut stream_reader = StreamReader::new(stream);

        self.bucket
            .put_object_stream_with_content_type(&mut stream_reader, path, content_type)
            .await?;

        Ok(())
    }
}
