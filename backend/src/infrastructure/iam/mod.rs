use std::{fs, path::Path};

use crate::errors::Result;
use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use yandex_cloud::{
    tonic_exports::Endpoint,
    yandex::cloud::iam::v1::{
        CreateIamTokenRequest, create_iam_token_request::Identity,
        iam_token_service_client::IamTokenServiceClient,
    },
};

#[derive(Serialize, Deserialize)]
struct Claim {
    iss: String,
    iat: i64,
    exp: i64,
    aud: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename = "camelCase")]
struct IAMSchema {
    id: String,
    service_account_id: String,
    created_at: DateTime<Utc>,
    key_algorithm: String,
    public_key: String,
    private_key: String,
}

struct TokenState {
    token: Option<String>,
    expiry_time: DateTime<Utc>,
}

#[derive(Clone)]
pub struct IAMTokenManager {
    iam: Arc<IAMSchema>,
    state: Arc<RwLock<TokenState>>,
}

impl IAMTokenManager {
    pub fn new(iam_key_file: impl AsRef<Path>) -> Result<Self> {
        let content = fs::read_to_string(iam_key_file).unwrap();
        let schema = serde_json::from_str(&content)?;
        let state = TokenState {
            token: None,
            expiry_time: DateTime::default(),
        };
        Ok(Self {
            iam: Arc::new(schema),
            state: Arc::new(RwLock::new(state)),
        })
    }

    pub async fn get_token(&self) -> Result<String> {
        {
            let state = self.state.read().await;
            if let Some(token) = &state.token
                && Utc::now() <= state.expiry_time
            {
                return Ok(token.clone());
            }
        }

        let mut state = self.state.write().await;

        if let Some(token) = &state.token
            && Utc::now() <= state.expiry_time
        {
            return Ok(token.clone());
        }

        let token = self.get_iam_token().await?;
        state.token = Some(token.clone());
        state.expiry_time = Utc::now() + Duration::seconds(50 * 60);

        Ok(token)
    }

    fn create_jwt(&self) -> Result<String> {
        let header = Header {
            typ: Some("JWT".to_string()),
            alg: Algorithm::PS256,
            kid: Some(self.iam.id.clone()),
            ..Default::default()
        };

        let iat = Utc::now().timestamp();
        let exp = iat + 3600;
        let claims = Claim {
            iss: self.iam.service_account_id.clone(),
            iat,
            exp,
            aud: "https://iam.api.cloud.yandex.net/iam/v1/tokens".to_string(),
        };

        let key = EncodingKey::from_rsa_pem(self.iam.private_key.as_bytes())?;

        let jwt = encode(&header, &claims, &key)?;

        Ok(jwt)
    }

    async fn get_iam_token(&self) -> Result<String> {
        let channel = Endpoint::from_static("https://iam.api.cloud.yandex.net")
            .connect()
            .await
            .unwrap();

        let mut client = IamTokenServiceClient::new(channel);

        let jwt = self.create_jwt()?;
        let request = CreateIamTokenRequest {
            identity: Some(Identity::Jwt(jwt)),
        };

        let response = client.create(request).await?;
        let token = response.into_inner().iam_token;

        Ok(token)
    }
}
