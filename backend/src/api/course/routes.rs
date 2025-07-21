use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use crate::{
    api::course::CourseState,
    domain::account::model::{UserModel, UserRole},
    dto::course::{UpsertCourseRequestDTO, UpsertCourseResponseDTO},
    errors::LMSError,
    utils::ValidatedJson,
};

/// Create a new course
#[utoipa::path(
    post,
    tag = "Course",
    path = "/new",
    request_body = UpsertCourseRequestDTO,
    responses(
        (status = 201, body = UpsertCourseResponseDTO, description = "Create new course"),
        (status = 400, description = "Invalid request body"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "User cannot create courses")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn create_course(
    user: UserModel,
    State(state): State<CourseState>,
    ValidatedJson(payload): ValidatedJson<UpsertCourseRequestDTO>,
) -> Result<(StatusCode, Json<UpsertCourseResponseDTO>), LMSError> {
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden(
            "User cannot create courses.".to_string(),
        ));
    }

    let course = state.course_service.create_course(user.id, payload).await?;

    Ok((StatusCode::CREATED, Json(course.into())))
}

/// Edit an existing course
#[utoipa::path(
    put,
    tag = "Course",
    path = "/{course_id}",
    request_body = UpsertCourseRequestDTO,
    responses(
        (status = 200, body = UpsertCourseResponseDTO, description = "Edit course"),
        (status = 400, description = "Invalid request body"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "User cannot edit courses")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn edit_course(
    user: UserModel,
    Path(course_id): Path<i32>,
    State(state): State<CourseState>,
    ValidatedJson(payload): ValidatedJson<UpsertCourseRequestDTO>,
) -> Result<Json<UpsertCourseResponseDTO>, LMSError> {
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden("User cannot edit courses.".to_string()));
    }

    let course = state
        .course_service
        .edit_course(course_id, user.id, payload)
        .await?;

    Ok(Json(course.into()))
}

/// Delete an existing course
#[utoipa::path(
    delete,
    tag = "Course",
    path = "/{course_id}",
    responses(
        (status = 204, description = "Delete course"),
        (status = 400, description = "Invalid request body"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "User cannot delete courses")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn delete_course(
    user: UserModel,
    Path(course_id): Path<i32>,
    State(state): State<CourseState>,
) -> Result<StatusCode, LMSError> {
    if matches!(user.role, UserRole::Student) {
        return Err(LMSError::Forbidden(
            "User cannot delete courses.".to_string(),
        ));
    }

    state
        .course_service
        .delete_course(course_id, user.id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Get all courses
#[utoipa::path(
    get,
    tag = "Course",
    path = "/",
    responses(
        (status = 200, body = [UpsertCourseResponseDTO], description = "Get all courses"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn get_all_courses(
    State(state): State<CourseState>,
) -> Result<Json<Vec<UpsertCourseResponseDTO>>, LMSError> {
    let courses = state.course_service.get_all_courses().await?;
    Ok(Json(courses.into_iter().map(Into::into).collect()))
}

/// Get course by id
#[utoipa::path(
    get,
    tag = "Course",
    path = "/{course_id}",
    params(
        ("course_id" = i32, Path)
    ),
    responses(
        (status = 200, body = UpsertCourseResponseDTO, description = "Get course by id"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Course not found")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn get_course_by_id(
    Path(course_id): Path<i32>,
    State(state): State<CourseState>,
) -> Result<Json<UpsertCourseResponseDTO>, LMSError> {
    let course = state.course_service.get_course_by_id(course_id).await?;
    Ok(Json(course.into()))
}
