use axum::{http::StatusCode, response::IntoResponse, Json};
use tracing::info;

pub type Result<T> = std::result::Result<T, LMSError>;

#[derive(thiserror::Error, Debug)]
pub enum LMSError {
    #[error("JWT error")]
    InvalidToken(#[from] jsonwebtoken::errors::Error),

    #[error("hashing error")]
    HashingError(#[from] argon2::Error),

    /// If the request was invalid or malformed.
    #[error("{0}")]
    InvalidRequest(#[from] validator::ValidationErrors),

    #[error("{0}")]
    ShitHappened(String),

    #[error("{0}")]
    AlreadyExists(String),

    /// An error occured when connection to or using the database.
    #[error("{0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("User already submit verification request")]
    VerificationError,

    /// Not found error
    #[error("{0}")]
    NotFound(String),

    /// Conflict Error
    #[error("{0}")]
    Conflict(String),

    /// Forbidden Error
    #[error("{0}")]
    Forbidden(String),

    #[error("Unimplemented route with current configuration")]
    Unimplemented,

    /// Any other, unknown error sources.
    #[error("{0}")]
    Unknown(#[source] Box<dyn std::error::Error + Send + Sync>),

    #[error("{0}")]
    DeployError(String),
}

impl IntoResponse for LMSError {
    fn into_response(self) -> axum::response::Response {
        let status = match &self {
            Self::AlreadyExists(_) | Self::InvalidRequest(_) | Self::ShitHappened(_) => {
                StatusCode::BAD_REQUEST
            }
            Self::DatabaseError(_)
            | Self::Unknown(_)
            | Self::HashingError(_)
            | Self::DeployError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::Unimplemented => StatusCode::NOT_IMPLEMENTED,
            Self::Forbidden(_) | Self::InvalidToken(_) => StatusCode::FORBIDDEN,
            Self::Conflict(_) | Self::VerificationError => StatusCode::CONFLICT,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
        };

        let message = self.to_string();
        info!("returning error: {}", message);

        (status, Json(serde_json::json!({ "error": message }))).into_response()
    }
}
