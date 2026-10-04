use std::{borrow::Cow, collections::HashMap, sync::Arc};

use async_trait::async_trait;
use axum::http::HeaderValue;
use futures::StreamExt;
use impl_unimplemented::impl_unimplemented;
use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, utf8_percent_encode};
use s3::{
    Bucket, BucketConfiguration, PostPolicy, PostPolicyField, PostPolicyValue, Region,
    creds::Credentials, error::S3Error, post_policy::PresignedPost,
};
use tokio_util::io::StreamReader;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::{config::Config, errors::LMSError, gen_openapi::DummyRepository};

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait S3 {
    async fn presign_post(&self, path: &str) -> Result<PresignedPost, S3Error>;
    async fn save_from_url(&self, path: &str, url: &str) -> Result<(), LMSError>;
    /// Presigned POST that lets a browser upload one object straight to the
    /// bucket: S3 itself enforces the exact key, content type and size range.
    async fn presign_upload(
        &self,
        path: &str,
        content_type: &str,
        max_size: u32,
        expiry_secs: u32,
    ) -> Result<PresignedPost, LMSError>;
    /// Size of a stored object in bytes, or `None` when it doesn't exist.
    async fn object_size(&self, path: &str) -> Result<Option<i64>, LMSError>;
    /// Short-lived GET link. With `download_name` set, the response is served as
    /// an attachment under that file name instead of the object key.
    async fn presign_get(
        &self,
        path: &str,
        expiry_secs: u32,
        download_name: Option<&str>,
    ) -> Result<String, LMSError>;
    async fn delete_object(&self, path: &str) -> Result<(), LMSError>;
}

#[derive(Clone)]
pub struct S3Manager {
    bucket: Arc<Bucket>,
    client: reqwest::Client,
}

impl S3Manager {
    pub async fn new(config: Config, client: reqwest::Client) -> anyhow::Result<Self> {
        let bucket_name = config.s3_bucket_name;
        let region = if config.s3_endpoint.is_empty() || config.s3_region.is_empty() {
            Region::Yandex
        } else {
            Region::Custom {
                region: config.s3_region,
                endpoint: config.s3_endpoint,
            }
        };
        let credentials = Credentials::default()?;

        let mut bucket =
            Bucket::new(&bucket_name, region.clone(), credentials.clone())?.with_path_style();

        if !bucket.exists().await? {
            // `exists` relies on ListBuckets, which can miss a bucket the key
            // doesn't own or list (or another replica just created it).
            match Bucket::create_with_path_style(
                &bucket_name,
                region,
                credentials,
                BucketConfiguration::default(),
            )
            .await
            {
                Ok(created) => bucket = created.bucket,
                Err(S3Error::HttpFailWithBody(409, body))
                    if body.contains("BucketAlreadyOwnedByYou") => {}
                Err(e) => return Err(e.into()),
            }
        }

        let manager = Self {
            bucket: bucket.into(),
            client,
        };

        Ok(manager)
    }

    /// Checks that objects under `prefix` can't be read without a signature,
    /// i.e. that presigned links are the only way in, and complains loudly
    /// otherwise. Scoped to a prefix because bucket policies are: a bucket can
    /// be public for avatars and private for everything else.
    ///
    /// Writes a real probe object and reads it back anonymously: asking for a
    /// missing key proves nothing, since some stores (Yandex Object Storage)
    /// answer 404 to anonymous requests even on private buckets.
    pub async fn warn_if_publicly_readable(&self, prefix: &str) {
        let name = self.bucket.name();
        let key = format!("{prefix}/privacy-probe/{}", Uuid::new_v4());

        if let Err(e) = self
            .bucket
            .put_object_with_content_type(&key, b"probe", "text/plain")
            .await
        {
            warn!("Could not check public access of S3 bucket `{name}`: {e}");
            return;
        }

        let url = format!("{}/{key}", self.bucket.url());
        match self.client.get(&url).send().await {
            Ok(response) if response.status().is_success() => error!(
                "S3 bucket `{name}` allows anonymous reads under `{prefix}/`: those objects \
                 are reachable without a presigned link. Remove the public access to this \
                 prefix from the bucket policy/ACL."
            ),
            Ok(response) => info!(
                "S3 bucket `{name}` keeps `{prefix}/` private (anonymous read got {})",
                response.status()
            ),
            Err(e) => warn!("Could not check public access of S3 bucket `{name}`: {e:?}"),
        }

        if let Err(e) = self.bucket.delete_object(&key).await {
            warn!("Failed to remove privacy probe `{key}` from S3 bucket `{name}`: {e}");
        }
    }
}

/// `Content-Disposition` value that keeps non-ASCII (e.g. Cyrillic) file names
/// intact via RFC 6266 `filename*`, with an ASCII fallback for old clients.
fn attachment_disposition(file_name: &str) -> String {
    let fallback: String = file_name
        .chars()
        .map(|c| {
            if (c.is_ascii_graphic() && c != '"' && c != '\\') || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let encoded = utf8_percent_encode(file_name, RFC5987_ATTR_CHAR);
    format!("attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}")
}

/// Everything except RFC 5987 `attr-char` gets percent-encoded.
const RFC5987_ATTR_CHAR: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'!')
    .remove(b'#')
    .remove(b'$')
    .remove(b'&')
    .remove(b'+')
    .remove(b'-')
    .remove(b'.')
    .remove(b'^')
    .remove(b'_')
    .remove(b'`')
    .remove(b'|')
    .remove(b'~');

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

    async fn presign_upload(
        &self,
        path: &str,
        content_type: &str,
        max_size: u32,
        expiry_secs: u32,
    ) -> Result<PresignedPost, LMSError> {
        let post_policy = PostPolicy::new(expiry_secs)
            .condition(
                PostPolicyField::Key,
                PostPolicyValue::Exact(Cow::from(path.to_string())),
            )?
            .condition(
                PostPolicyField::ContentType,
                PostPolicyValue::Exact(Cow::from(content_type.to_string())),
            )?
            .condition(
                PostPolicyField::ContentLengthRange,
                PostPolicyValue::Range(1, max_size),
            )?;

        Ok(self.bucket.presign_post(post_policy).await?)
    }

    async fn object_size(&self, path: &str) -> Result<Option<i64>, LMSError> {
        match self.bucket.head_object(path).await {
            Ok((head, _)) => Ok(Some(head.content_length.unwrap_or_default())),
            Err(S3Error::HttpFailWithBody(404, _)) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    async fn presign_get(
        &self,
        path: &str,
        expiry_secs: u32,
        download_name: Option<&str>,
    ) -> Result<String, LMSError> {
        let queries = download_name.map(|name| {
            HashMap::from([(
                "response-content-disposition".to_string(),
                attachment_disposition(name),
            )])
        });

        Ok(self.bucket.presign_get(path, expiry_secs, queries).await?)
    }

    async fn delete_object(&self, path: &str) -> Result<(), LMSError> {
        match self.bucket.delete_object(path).await {
            // 404 means it is already gone, which is what we wanted
            Ok(_) | Err(S3Error::HttpFailWithBody(404, _)) => Ok(()),
            Err(e) => Err(e.into()),
        }
    }
}
