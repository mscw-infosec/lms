use std::sync::Arc;

use axum::{
    extract::{Query, State},
    response::Redirect,
};
use tower_cookies::Cookies;

use crate::{
    api::dto::oauth::github::OAuthCallbackQuery,
    domain::oauth::service::{OAuthProvider, OAuthService},
    errors::LMSError,
    infrastructure::jwt::Claim,
    utils::add_cookie,
};

use super::GithubState;

#[utoipa::path(get, path = "/login", tag = "OAuth")]
pub async fn login(cookies: Cookies, State(state): State<Arc<GithubState>>) -> Redirect {
    let (oauth_state, code_verifier, code_challenge) = OAuthService::generate();

    add_cookie(&cookies, ("oauth_state", oauth_state.clone()));
    add_cookie(&cookies, ("code_verifier", code_verifier));

    let url = state.provider.url(oauth_state, code_challenge);
    Redirect::temporary(url.as_str())
}

#[utoipa::path(get, path = "/callback", tag = "OAuth")]
pub async fn callback(
    cookies: Cookies,
    Query(query): Query<OAuthCallbackQuery>,
    State(state): State<Arc<GithubState>>,
) -> Result<String, LMSError> {
    let (oauth_state, code_verifier) = OAuthService::parse_cookies(&cookies)?;

    if oauth_state != query.state {
        return Err(LMSError::Forbidden("Invalid `state` parameter".to_string()));
    }

    let user = state.provider.get_user(query.code, code_verifier).await?;
    let user_id = state.service.save_user(user).await?;

    let (refresh, access) = Claim::generate_tokens(user_id, &state.jwt_secret)?;
    add_cookie(&cookies, ("refresh_token", refresh));

    Ok(access)
}
