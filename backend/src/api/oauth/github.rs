use axum::{
    Json,
    extract::{Query, State},
    response::Redirect,
};
use tower_cookies::Cookies;

use crate::{
    domain::oauth::service::{OAuthProvider, OAuthService},
    dto::oauth::{OAuthCallbackQuery, OAuthResponse},
    errors::LMSError,
    utils::{add_cookie, remove_cookie},
};

use super::GithubState;

/// Redirect user to github oauth login page
#[utoipa::path(get, path = "/login", tag = "OAuth")]
pub async fn login(cookies: Cookies, State(state): State<GithubState>) -> Redirect {
    let (oauth_state, code_verifier, code_challenge) = OAuthService::generate();

    add_cookie(&cookies, ("oauth_state", oauth_state.clone()));
    add_cookie(&cookies, ("code_verifier", code_verifier));

    let url = state.github_provider.url(oauth_state, code_challenge);
    Redirect::temporary(url.as_str())
}

/// Callback for github oauth provider
#[utoipa::path(get, path = "/callback", tag = "OAuth")]
pub async fn callback(
    cookies: Cookies,
    Query(query): Query<OAuthCallbackQuery>,
    State(state): State<GithubState>,
) -> Result<Json<OAuthResponse>, LMSError> {
    let (oauth_state, code_verifier) = OAuthService::parse_cookies(&cookies)?;

    if oauth_state != query.state {
        return Err(LMSError::Forbidden("Invalid `state` parameter".to_string()));
    }

    let user = state
        .github_provider
        .get_user(query.code, code_verifier)
        .await?;
    let user_id = state.oauth_service.save_user(user).await?;

    let (refresh_token, _) = state
        .refresh_token_service
        .create_refresh_token(user_id)
        .await?;
    let access_token = state.jwt.generate_access_token(user_id)?;

    add_cookie(&cookies, ("refresh_token", refresh_token));

    remove_cookie(&cookies, "oauth_state");
    remove_cookie(&cookies, "code_verifier");

    Ok(Json(OAuthResponse { access_token }))
}
