use std::{borrow::Cow, sync::Arc};

use s3::{
    Bucket, BucketConfiguration, PostPolicy, PostPolicyField, PostPolicyValue, Region,
    creds::Credentials, error::S3Error, post_policy::PresignedPost,
};

use crate::config::Config;

#[derive(Clone)]
pub struct S3Manager {
    bucket: Arc<Bucket>,
}

impl S3Manager {
    pub async fn new(config: Config) -> anyhow::Result<Self> {
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
        };

        Ok(manager)
    }

    pub async fn presign_post(&self, path: &str) -> Result<PresignedPost, S3Error> {
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
}
