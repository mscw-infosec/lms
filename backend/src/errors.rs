use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Redirect},
};
use tracing::info;
use yandex_cloud::tonic_exports;

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

    /// A generic catch-all error for unexpected situations.
    #[error("{0}")]
    ShitHappened(String),

    #[error("{0}")]
    AlreadyExists(String),

    /// An error occurred when connecting to or using the database.
    #[error("{0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("User already submit verification request")]
    VerificationError,

    /// Error indicating a resource was not found.
    #[error("{0}")]
    NotFound(String),

    /// Error indicating a conflict (e.g., duplicate data).
    #[error("{0}")]
    Conflict(String),

    /// Forbidden Error
    #[error("{0}")]
    Forbidden(String),

    /// Unauthorized Error
    #[error("{0}")]
    Unauthorized(String),

    #[error("Unimplemented route with current configuration")]
    Unimplemented,

    /// Any other, unknown error sources.
    #[error("{0}")]
    Unknown(#[source] Box<dyn std::error::Error + Send + Sync>),

    #[error("{0}")]
    DeployError(String),

    /// An error occured when connection to or using the redis.
    #[error("{0}")]
    RedisError(#[from] redis::RedisError),

    #[error("{0}")]
    SerdeError(#[from] serde_json::Error),

    #[error("{0}")]
    GRPCError(#[from] tonic_exports::Status),

    #[error("{0}")]
    S3Error(#[from] s3::error::S3Error),

    #[error("Redirect to {0}")]
    Redirect(&'static str),
}

impl IntoResponse for LMSError {
    fn into_response(self) -> axum::response::Response {
        let status = match &self {
            Self::Redirect(redirect) => return Redirect::temporary(redirect).into_response(),
            Self::AlreadyExists(_) | Self::InvalidRequest(_) | Self::ShitHappened(_) => {
                StatusCode::BAD_REQUEST
            }
            Self::DatabaseError(_)
            | Self::Unknown(_)
            | Self::HashingError(_)
            | Self::DeployError(_)
            | Self::RedisError(_)
            | Self::SerdeError(_)
            | Self::GRPCError(_)
            | Self::S3Error(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::Unimplemented => StatusCode::NOT_IMPLEMENTED,
            Self::Forbidden(_) | Self::InvalidToken(_) => StatusCode::FORBIDDEN,
            Self::Conflict(_) | Self::VerificationError => StatusCode::CONFLICT,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
        };

        let message = self.to_string();
        info!("returning error: {}", message);

        (status, Json(serde_json::json!({ "error": message }))).into_response()
    }
}
