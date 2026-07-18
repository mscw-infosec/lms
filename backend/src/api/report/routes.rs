use axum::{
    Json,
    body::Body,
    extract::{Path, State},
    http::header,
    response::Response,
};
use uuid::Uuid;

use crate::infrastructure::jwt::AccessTokenClaim;
use crate::{
    api::report::ReportState, domain::account::model::UserRole, domain::report::model::Gradebook,
    dto::report::ExportQuery, errors::LMSError, utils::ValidatedQuery,
};

/// Exam gradebook: per-attempt scores plus summary statistics.
#[utoipa::path(
    get,
    tag = "Report",
    path = "/exam/{exam_id}",
    params(
        ("exam_id" = Uuid, Path)
    ),
    responses(
        (status = 200, body = Gradebook, description = "Exam gradebook"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "Only teachers/admins can view reports"),
        (status = 404, description = "Exam not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn get_exam_gradebook(
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ReportState>,
) -> Result<Json<Gradebook>, LMSError> {
    if !matches!(claims.role, UserRole::Teacher | UserRole::Admin) {
        return Err(LMSError::Forbidden(
            "Only teachers and admins can view reports".to_string(),
        ));
    }

    let gradebook = state
        .report_service
        .exam_gradebook(exam_id, claims.sub, claims.role)
        .await?;

    Ok(Json(gradebook))
}

/// Export exam results as a downloadable file (CSV or XLSX).
#[utoipa::path(
    get,
    tag = "Report",
    path = "/exam/{exam_id}/export",
    params(
        ("exam_id" = Uuid, Path),
        ("format" = Option<String>, Query, description = "csv (default) or xlsx")
    ),
    responses(
        (status = 200, description = "Exam results file (text/csv or xlsx)"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "Only teachers/admins can export results"),
        (status = 404, description = "Exam not found")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn export_exam_results(
    claims: AccessTokenClaim,
    Path(exam_id): Path<Uuid>,
    State(state): State<ReportState>,
    ValidatedQuery(query): ValidatedQuery<ExportQuery>,
) -> Result<Response, LMSError> {
    if !matches!(claims.role, UserRole::Teacher | UserRole::Admin) {
        return Err(LMSError::Forbidden(
            "Only teachers and admins can export results".to_string(),
        ));
    }

    let file = state
        .report_service
        .exam_export(exam_id, claims.sub, claims.role, query.format.into())
        .await?;

    Response::builder()
        .header(header::CONTENT_TYPE, file.content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file.filename),
        )
        .body(Body::from(file.bytes))
        .map_err(|e| LMSError::ServerError(e.to_string()))
}
