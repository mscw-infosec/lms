use async_trait::async_trait;
use reqwest::header::ACCEPT;
use serde::Deserialize;
use url::Url;

use crate::{
    domain::oauth::{
        model::{OAuth, Providers},
        service::{AccessTokenResponse, OAuthProvider},
    },
    errors::LMSError,
    utils::send_and_parse,
};

const GITHUB_AUTH_URL: &str = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const GITHUB_USER_API: &str = "https://api.github.com/user";
const GITHUB_EMAILS_API: &str = "https://api.github.com/user/emails";

#[derive(Clone)]
pub struct GithubProvider {
    pub client: reqwest::Client,
    pub client_id: String,
    pub client_secret: String,
    pub callback_url: String,
}

#[derive(Deserialize, Debug)]
struct GithubUserResponse {
    pub id: i32,
    pub login: String,
    pub avatar_url: String,
}

#[derive(Deserialize, Debug)]
struct GithubEmailResponse {
    pub email: String,
    pub primary: bool,
}

#[async_trait]
impl OAuthProvider for GithubProvider {
    fn url(&self, state: String, code_challenge: String) -> Url {
        let mut url = Url::parse(GITHUB_AUTH_URL).expect("Wrong URL");
        url.query_pairs_mut()
            .append_pair("client_id", &self.client_id)
            .append_pair("redirect_uri", &self.callback_url)
            .append_pair("response_type", "code")
            .append_pair("scope", "read:user user:email")
            .append_pair("state", &state)
            .append_pair("code_challenge", &code_challenge)
            .append_pair("code_challenge_method", "S256");
        url
    }

    async fn get_user(&self, code: String, code_verifier: String) -> Result<OAuth, LMSError> {
        let token = send_and_parse::<AccessTokenResponse>(
            self.client
                .post(GITHUB_TOKEN_URL)
                .form(&[
                    ("grant_type", "authorization_code"),
                    ("code", &code),
                    ("client_id", &self.client_id),
                    ("client_secret", &self.client_secret),
                    ("redirect_uri", &self.callback_url),
                    ("code_verifier", &code_verifier),
                ])
                .header(ACCEPT, "application/json"),
            "GitHub token endpoint",
        )
        .await?;

        let user = send_and_parse::<GithubUserResponse>(
            self.client
                .get(GITHUB_USER_API)
                .bearer_auth(&token.access_token),
            "GitHub user API",
        )
        .await?;

        let emails = send_and_parse::<Vec<GithubEmailResponse>>(
            self.client
                .get(GITHUB_EMAILS_API)
                .bearer_auth(&token.access_token),
            "GitHub user emails API",
        )
        .await?;

        let email = emails
            .into_iter()
            .find(|e| e.primary)
            .map(|e| e.email)
            .unwrap_or_default();

        Ok(OAuth {
            client_id: user.id.to_string(),
            username: user.login,
            email,
            avatar_url: user.avatar_url,
            provider: Providers::Github,
        })
    }
}
