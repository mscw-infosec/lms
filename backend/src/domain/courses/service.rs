use uuid::Uuid;

use crate::{
    domain::{
        account::{
            model::{Attributes, UserRole},
            service::AccountService,
        },
        courses::{
            model::{AttributeFilter, ConditionOp, CourseModel},
            repository::CourseRepository,
        },
    },
    dto::course::UpsertCourseRequestDTO,
    errors::{LMSError, Result},
    repo,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct CourseService {
    repo: repo!(CourseRepository),
    account_service: AccountService,
}

impl CourseService {
    pub fn new(repo: repo!(CourseRepository), account_service: AccountService) -> Self {
        Self {
            repo,
            account_service,
        }
    }

    pub async fn get_all_courses(&self, user_id: Uuid, role: UserRole) -> Result<Vec<CourseModel>> {
        if role != UserRole::Student {
            return self.repo.get_all_courses().await;
        }

        let user_promise = self.account_service.get_user(user_id);
        let courses_promise = self.repo.get_all_courses();
        let (user, courses) = tokio::try_join!(user_promise, courses_promise)?;

        let filtered_courses: Vec<CourseModel> = courses
            .into_iter()
            .filter(|course| {
                if course.access_filter.is_none() {
                    return true;
                }

                if let Some(filter) = &course.access_filter {
                    return Self::evaluate_filter(filter, &user.attributes);
                }

                true
            })
            .collect();

        Ok(filtered_courses)
    }

    pub async fn get_course_by_id(
        &self,
        user_id: Uuid,
        role: UserRole,
        course_id: i32,
    ) -> Result<CourseModel> {
        if role != UserRole::Student {
            return self.repo.get_course_by_id(course_id).await;
        }

        let user_promise = self.account_service.get_user(user_id);
        let course_promise = self.repo.get_course_by_id(course_id);
        let (user, course) = tokio::try_join!(user_promise, course_promise)?;

        if course.access_filter.is_none() {
            return Ok(course);
        }

        if let Some(filter) = &course.access_filter
            && !Self::evaluate_filter(filter, &user.attributes)
        {
            return Err(LMSError::Forbidden(
                "You do not have access to this course.".to_string(),
            ));
        }

        Ok(course)
    }

    fn evaluate_filter(filter: &AttributeFilter, user_attrs: &Attributes) -> bool {
        match filter {
            AttributeFilter::Condition { key, op, value } => match op {
                ConditionOp::Eq => {
                    user_attrs.get(key) == value.as_str().map(ToString::to_string).as_ref()
                }
                ConditionOp::Neq => {
                    user_attrs.get(key) != value.as_str().map(ToString::to_string).as_ref()
                }
                ConditionOp::Gt => {
                    if let (Some(user_val), Some(cond_val)) = (user_attrs.get(key), value.as_i64())
                        && let Ok(user_val_num) = user_val.parse::<i64>()
                    {
                        return user_val_num > cond_val;
                    }
                    false
                }
                ConditionOp::Gte => {
                    if let (Some(user_val), Some(cond_val)) = (user_attrs.get(key), value.as_i64())
                        && let Ok(user_val_num) = user_val.parse::<i64>()
                    {
                        return user_val_num >= cond_val;
                    }
                    false
                }
                ConditionOp::Lt => {
                    if let (Some(user_val), Some(cond_val)) = (user_attrs.get(key), value.as_i64())
                        && let Ok(user_val_num) = user_val.parse::<i64>()
                    {
                        return user_val_num < cond_val;
                    }
                    false
                }
                ConditionOp::Lte => {
                    if let (Some(user_val), Some(cond_val)) = (user_attrs.get(key), value.as_i64())
                        && let Ok(user_val_num) = user_val.parse::<i64>()
                    {
                        return user_val_num <= cond_val;
                    }
                    false
                }
                ConditionOp::In => {
                    if let Some(cond_vals) = value.as_array()
                        && let Some(user_val) = user_attrs.get(key)
                    {
                        return cond_vals.iter().any(|v| v.as_str() == Some(user_val));
                    }
                    false
                }
                ConditionOp::Nin => {
                    if let Some(cond_vals) = value.as_array()
                        && let Some(user_val) = user_attrs.get(key)
                    {
                        return !cond_vals.iter().any(|v| v.as_str() == Some(user_val));
                    }
                    false
                }
            },
            AttributeFilter::And(children) => children
                .iter()
                .all(|c| Self::evaluate_filter(c, user_attrs)),
            AttributeFilter::Or(attribute_filters) => attribute_filters
                .iter()
                .any(|c| Self::evaluate_filter(c, user_attrs)),
        }
    }

    pub async fn create_course(
        &self,
        user_id: Uuid,
        course: UpsertCourseRequestDTO,
    ) -> Result<CourseModel> {
        self.repo.create_course(user_id, course).await
    }

    pub async fn edit_course(
        &self,
        course_id: i32,
        user_id: Uuid,
        course: UpsertCourseRequestDTO,
    ) -> Result<CourseModel> {
        self.repo.edit_course(course_id, user_id, course).await
    }

    pub async fn delete_course(&self, course_id: i32, user_id: Uuid) -> Result<()> {
        self.repo.delete_course(course_id, user_id).await
    }

    pub fn get_course_feed() -> Result<()> {
        todo!()
    }
}
