use axum::{
    Json,
    extract::{Path, State},
};

use crate::{
    api::course::CourseState, dto::topics::TopicResponseDTO, errors::LMSError,
    infrastructure::jwt::AccessTokenClaim,
};

/// Retrieves all topics associated with a specific course.
#[utoipa::path(
    get,
    tag = "Topic",
    path = "/{course_id}/topics",
    responses(
        (status = 200, body = Vec<TopicResponseDTO>, description = "List of topics in the course", ),
        (status = 404, description = "Course not found"),
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn get_all_topics_in_course(
    // TODO: Start using proper ACL
    _: AccessTokenClaim,
    Path(course_id): Path<i32>,
    State(state): State<CourseState>,
) -> Result<Json<Vec<TopicResponseDTO>>, LMSError> {
    let topics = state
        .topic_service
        .get_all_topics_in_course(course_id)
        .await?
        .into_iter()
        .map(From::from)
        .collect();

    Ok(Json(topics))
}
