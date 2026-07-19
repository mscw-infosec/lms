use axum::{
    Json,
    body::Body,
    extract::{Path, State},
    http::header,
    response::Response,
};
use uuid::Uuid;

use crate::domain::report::model::ExportFile;
use crate::infrastructure::jwt::AccessTokenClaim;
use crate::{
    api::rating::RatingState,
    dto::rating::{
        CourseLeaderboardDTO, CourseUserRatingDTO, LeaderboardQuery, UserOverallRatingDTO,
    },
    dto::report::ExportQuery,
    errors::LMSError,
    utils::ValidatedQuery,
};

fn file_response(file: ExportFile) -> Result<Response, LMSError> {
    Response::builder()
        .header(header::CONTENT_TYPE, file.content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file.filename),
        )
        .body(Body::from(file.bytes))
        .map_err(|e| LMSError::ServerError(e.to_string()))
}

/// Overall rating of the authenticated user across all their courses.
#[utoipa::path(
    get,
    tag = "Rating",
    path = "/me",
    responses(
        (status = 200, body = UserOverallRatingDTO, description = "Overall rating"),
        (status = 401, description = "No auth data found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn get_my_overall(
    claims: AccessTokenClaim,
    State(state): State<RatingState>,
) -> Result<Json<UserOverallRatingDTO>, LMSError> {
    let rating = state
        .rating_service
        .user_overall(claims.sub, claims.sub, claims.role)
        .await?;
    Ok(Json(rating))
}

/// Export the authenticated user's overall rating (CSV or XLSX).
#[utoipa::path(
    get,
    tag = "Rating",
    path = "/me/export",
    params(("format" = Option<String>, Query, description = "csv (default) or xlsx")),
    responses(
        (status = 200, description = "Rating file (text/csv or xlsx)"),
        (status = 401, description = "No auth data found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn export_my_overall(
    claims: AccessTokenClaim,
    State(state): State<RatingState>,
    ValidatedQuery(query): ValidatedQuery<ExportQuery>,
) -> Result<Response, LMSError> {
    let file = state
        .rating_service
        .user_overall_export(claims.sub, claims.sub, claims.role, query.format.into())
        .await?;
    file_response(file)
}

/// Overall rating of a specific user. Self or teacher/admin only.
#[utoipa::path(
    get,
    tag = "Rating",
    path = "/user/{user_id}",
    params(("user_id" = Uuid, Path)),
    responses(
        (status = 200, body = UserOverallRatingDTO, description = "Overall rating"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You can only view your own rating"),
        (status = 404, description = "User not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn get_user_overall(
    claims: AccessTokenClaim,
    Path(user_id): Path<Uuid>,
    State(state): State<RatingState>,
) -> Result<Json<UserOverallRatingDTO>, LMSError> {
    let rating = state
        .rating_service
        .user_overall(user_id, claims.sub, claims.role)
        .await?;
    Ok(Json(rating))
}

/// Export a specific user's overall rating. Self or teacher/admin only.
#[utoipa::path(
    get,
    tag = "Rating",
    path = "/user/{user_id}/export",
    params(
        ("user_id" = Uuid, Path),
        ("format" = Option<String>, Query, description = "csv (default) or xlsx")
    ),
    responses(
        (status = 200, description = "Rating file (text/csv or xlsx)"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You can only view your own rating"),
        (status = 404, description = "User not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn export_user_overall(
    claims: AccessTokenClaim,
    Path(user_id): Path<Uuid>,
    State(state): State<RatingState>,
    ValidatedQuery(query): ValidatedQuery<ExportQuery>,
) -> Result<Response, LMSError> {
    let file = state
        .rating_service
        .user_overall_export(user_id, claims.sub, claims.role, query.format.into())
        .await?;
    file_response(file)
}

/// Leaderboard of all participants in a course. Teacher/admin only.
#[utoipa::path(
    get,
    tag = "Rating",
    path = "/course/{course_id}",
    params(
        ("course_id" = i32, Path),
        ("limit" = i32, Query, description = "Page size (1..=100)"),
        ("offset" = i32, Query),
        ("search" = Option<String>, Query, description = "Substring match on username or email")
    ),
    responses(
        (status = 200, body = CourseLeaderboardDTO, description = "Course leaderboard page"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "Only teachers/admins can view a leaderboard"),
        (status = 404, description = "Course not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn get_course_leaderboard(
    claims: AccessTokenClaim,
    Path(course_id): Path<i32>,
    State(state): State<RatingState>,
    ValidatedQuery(query): ValidatedQuery<LeaderboardQuery>,
) -> Result<Json<CourseLeaderboardDTO>, LMSError> {
    let board = state
        .rating_service
        .course_leaderboard(course_id, claims.sub, claims.role, query)
        .await?;
    Ok(Json(board))
}

/// Export a course leaderboard. Teacher/admin only.
#[utoipa::path(
    get,
    tag = "Rating",
    path = "/course/{course_id}/export",
    params(
        ("course_id" = i32, Path),
        ("format" = Option<String>, Query, description = "csv (default) or xlsx")
    ),
    responses(
        (status = 200, description = "Leaderboard file (text/csv or xlsx)"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "Only teachers/admins can export a leaderboard"),
        (status = 404, description = "Course not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn export_course_leaderboard(
    claims: AccessTokenClaim,
    Path(course_id): Path<i32>,
    State(state): State<RatingState>,
    ValidatedQuery(query): ValidatedQuery<ExportQuery>,
) -> Result<Response, LMSError> {
    let file = state
        .rating_service
        .course_leaderboard_export(course_id, claims.sub, claims.role, query.format.into())
        .await?;
    file_response(file)
}

/// The authenticated user's detailed rating within a course.
#[utoipa::path(
    get,
    tag = "Rating",
    path = "/course/{course_id}/me",
    params(("course_id" = i32, Path)),
    responses(
        (status = 200, body = CourseUserRatingDTO, description = "Per-course rating"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You do not have access to this course"),
        (status = 404, description = "Course not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn get_my_course_rating(
    claims: AccessTokenClaim,
    Path(course_id): Path<i32>,
    State(state): State<RatingState>,
) -> Result<Json<CourseUserRatingDTO>, LMSError> {
    let rating = state
        .rating_service
        .course_user(course_id, claims.sub, claims.sub, claims.role)
        .await?;
    Ok(Json(rating))
}

/// Export the authenticated user's per-course rating (CSV or XLSX).
#[utoipa::path(
    get,
    tag = "Rating",
    path = "/course/{course_id}/me/export",
    params(
        ("course_id" = i32, Path),
        ("format" = Option<String>, Query, description = "csv (default) or xlsx")
    ),
    responses(
        (status = 200, description = "Rating file (text/csv or xlsx)"),
        (status = 401, description = "No auth data found"),
        (status = 404, description = "Course not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn export_my_course_rating(
    claims: AccessTokenClaim,
    Path(course_id): Path<i32>,
    State(state): State<RatingState>,
    ValidatedQuery(query): ValidatedQuery<ExportQuery>,
) -> Result<Response, LMSError> {
    let file = state
        .rating_service
        .course_user_export(
            course_id,
            claims.sub,
            claims.sub,
            claims.role,
            query.format.into(),
        )
        .await?;
    file_response(file)
}

/// A specific user's detailed rating within a course. Self or teacher/admin.
#[utoipa::path(
    get,
    tag = "Rating",
    path = "/course/{course_id}/user/{user_id}",
    params(("course_id" = i32, Path), ("user_id" = Uuid, Path)),
    responses(
        (status = 200, body = CourseUserRatingDTO, description = "Per-course rating"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You can only view your own rating"),
        (status = 404, description = "Course or user not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn get_user_course_rating(
    claims: AccessTokenClaim,
    Path((course_id, user_id)): Path<(i32, Uuid)>,
    State(state): State<RatingState>,
) -> Result<Json<CourseUserRatingDTO>, LMSError> {
    let rating = state
        .rating_service
        .course_user(course_id, user_id, claims.sub, claims.role)
        .await?;
    Ok(Json(rating))
}

/// Export a specific user's per-course rating. Self or teacher/admin.
#[utoipa::path(
    get,
    tag = "Rating",
    path = "/course/{course_id}/user/{user_id}/export",
    params(
        ("course_id" = i32, Path),
        ("user_id" = Uuid, Path),
        ("format" = Option<String>, Query, description = "csv (default) or xlsx")
    ),
    responses(
        (status = 200, description = "Rating file (text/csv or xlsx)"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "You can only view your own rating"),
        (status = 404, description = "Course or user not found")
    ),
    security(("BearerAuth" = []))
)]
pub async fn export_user_course_rating(
    claims: AccessTokenClaim,
    Path((course_id, user_id)): Path<(i32, Uuid)>,
    State(state): State<RatingState>,
    ValidatedQuery(query): ValidatedQuery<ExportQuery>,
) -> Result<Response, LMSError> {
    let file = state
        .rating_service
        .course_user_export(
            course_id,
            user_id,
            claims.sub,
            claims.role,
            query.format.into(),
        )
        .await?;
    file_response(file)
}
