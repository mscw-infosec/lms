use axum::{
    Json,
    http::{StatusCode, header::WWW_AUTHENTICATE},
    response::{IntoResponse, Response},
};
use tracing::warn;

use crate::errors::LMSError;

#[derive(Debug, Clone)]
pub struct OAuthError {
    pub status: StatusCode,
    pub error: &'static str,
    pub description: String,
}

impl OAuthError {
    fn new(status: StatusCode, error: &'static str, description: impl Into<String>) -> Self {
        Self {
            status,
            error,
            description: description.into(),
        }
    }

    pub fn invalid_request(description: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "invalid_request", description)
    }

    pub fn invalid_client(description: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "invalid_client", description)
    }

    pub fn invalid_grant(description: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "invalid_grant", description)
    }

    pub fn unauthorized_client(description: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "unauthorized_client", description)
    }

    pub fn unsupported_grant_type(description: impl Into<String>) -> Self {
        Self::new(
            StatusCode::BAD_REQUEST,
            "unsupported_grant_type",
            description,
        )
    }

    pub fn invalid_scope(description: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "invalid_scope", description)
    }

    pub fn access_denied(description: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, "access_denied", description)
    }

    pub fn invalid_token(description: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "invalid_token", description)
    }

    pub fn insufficient_scope(description: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, "insufficient_scope", description)
    }

    pub fn server_error(description: impl Into<String>) -> Self {
        Self::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "server_error",
            description,
        )
    }

    pub fn not_found(description: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "invalid_request", description)
    }
}

impl From<LMSError> for OAuthError {
    fn from(value: LMSError) -> Self {
        warn!(error = ?value, "SSO request failed with an internal error");
        Self::server_error(value.to_string())
    }
}

impl IntoResponse for OAuthError {
    fn into_response(self) -> Response {
        let body = Json(serde_json::json!({
            "error": self.error,
            "error_description": self.description,
        }));

        let mut response = (self.status, body).into_response();

        // Bearer-protected resources must say why the token was refused.
        if matches!(
            self.status,
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN
        ) && let Ok(value) = format!(
            r#"Bearer error="{}", error_description="{}""#,
            self.error,
            self.description.replace('"', "'")
        )
        .parse()
        {
            response.headers_mut().insert(WWW_AUTHENTICATE, value);
        }

        response
    }
}
