use crate::{
    domain::oauth::{
        model::{OAuth, Providers},
        service::{AccessTokenResponse, OAuthProvider},
    },
    errors::LMSError,
    utils::send_and_parse,
};
use async_trait::async_trait;
use serde::Deserialize;
use url::Url;

const YANDEX_AUTH_URL: &str = "https://oauth.yandex.ru/authorize";
const YANDEX_TOKEN_URL: &str = "https://oauth.yandex.ru/token";
const YANDEX_USER_API: &str = "https://login.yandex.ru/info";
const YANDEX_AVATAR_URL: &str = "https://avatars.yandex.net/get-yapic";
const YANDEX_AVATAR_SIZE: &str = "islands-200";

#[derive(Clone)]
pub struct YandexProvider {
    pub client: reqwest::Client,
    pub client_id: String,
    pub client_secret: String,
    pub callback_url: String,
}

#[derive(Deserialize, Debug)]
struct YandexUserResponse {
    pub id: String,
    pub display_name: String,
    pub default_email: String,
    pub default_avatar_id: String,
}

#[async_trait]
impl OAuthProvider for YandexProvider {
    fn url(&self, state: String, code_challenge: String) -> Url {
        let mut url = Url::parse(YANDEX_AUTH_URL).expect("Wrong URL");
        url.query_pairs_mut()
            .append_pair("response_type", "code")
            .append_pair("client_id", &self.client_id)
            .append_pair("scope", "login:email login:info login:avatar")
            .append_pair("state", &state)
            .append_pair("code_challenge", &code_challenge)
            .append_pair("code_challenge_method", "S256");
        url
    }

    async fn get_user(&self, code: String, code_verifier: String) -> Result<OAuth, LMSError> {
        let token = send_and_parse::<AccessTokenResponse>(
            self.client
                .post(YANDEX_TOKEN_URL)
                .basic_auth(&self.client_id, Some(&self.client_secret))
                .form(&[
                    ("grant_type", "authorization_code"),
                    ("code", &code),
                    ("client_id", &self.client_id),
                    ("client_secret", &self.client_secret),
                    ("redirect_uri", &self.callback_url),
                    ("code_verifier", &code_verifier),
                ]),
            "Yandex token endpoint",
        )
        .await?;

        let user = send_and_parse::<YandexUserResponse>(
            self.client
                .get(YANDEX_USER_API)
                .query(&[("format", "json")])
                .bearer_auth(token.access_token),
            "Yandex user API",
        )
        .await?;

        let oauth = OAuth {
            client_id: user.id,
            username: user.display_name,
            email: user.default_email,
            avatar_url: format!(
                "{}/{}/{}",
                YANDEX_AVATAR_URL, user.default_avatar_id, YANDEX_AVATAR_SIZE,
            ),
            provider: Providers::Yandex,
        };

        Ok(oauth)
    }
}
