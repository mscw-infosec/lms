use async_trait::async_trait;
use uuid::Uuid;

use crate::{
    domain::courses::{model::CourseModel, repository::CourseRepository},
    dto::course::UpsertCourseRequestDTO,
    errors::{LMSError, Result},
    infrastructure::db::postgres::RepositoryPostgres,
};

#[async_trait]
impl CourseRepository for RepositoryPostgres {
    async fn create_course(
        &self,
        user_id: Uuid,
        course: UpsertCourseRequestDTO,
    ) -> Result<CourseModel> {
        let mut tx = self.pool.begin().await?;

        let (course_id, created_at) = sqlx::query!(
            r#"
            INSERT INTO courses (title, description)
            VALUES ($1, $2)
            RETURNING id, created_at
            "#,
            course.name,
            course.description
        )
        .fetch_one(tx.as_mut())
        .await
        .map(|x| (x.id, x.created_at))?;

        sqlx::query!(
            r#"
            INSERT INTO course_owners (course_id, user_id)
            VALUES ($1, $2)
            "#,
            course_id,
            user_id
        )
        .execute(tx.as_mut())
        .await?;

        tx.commit().await?;

        let course_model = CourseModel {
            id: course_id,
            title: course.name,
            description: course.description,
            created_at,
        };

        Ok(course_model)
    }

    async fn edit_course(
        &self,
        course_id: i32,
        user_id: Uuid,
        course: UpsertCourseRequestDTO,
    ) -> Result<CourseModel> {
        let mut tx = self.pool.begin().await?;

        let result = sqlx::query!(
            r#"
            SELECT
                EXISTS(SELECT 1 FROM courses WHERE id = $1) AS "course_exists!: bool",
                EXISTS(SELECT 1 FROM course_owners WHERE course_id = $1 AND user_id = $2) AS "is_owner!: bool"
            "#,
            course_id,
            user_id
        )
        .fetch_one(tx.as_mut())
        .await?;

        if !result.course_exists {
            return Err(LMSError::NotFound(format!(
                "Course with id {course_id} not found"
            )));
        }

        if !result.is_owner {
            return Err(LMSError::Forbidden(format!(
                "User is not the owner of course {course_id}"
            )));
        }

        let course_model = sqlx::query_as!(
            CourseModel,
            r#"
            UPDATE courses
            SET title = $1, description = $2
            WHERE id = $3
            RETURNING id, title, description, created_at
            "#,
            course.name,
            course.description,
            course_id
        )
        .fetch_one(tx.as_mut())
        .await?;

        tx.commit().await?;

        Ok(course_model)
    }

    async fn delete_course(&self, course_id: i32, user_id: Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        let result = sqlx::query!(
            r#"
            SELECT
                EXISTS(SELECT 1 FROM courses WHERE id = $1) AS "course_exists!: bool",
                EXISTS(SELECT 1 FROM course_owners WHERE course_id = $1 AND user_id = $2) AS "is_owner!: bool"
            "#,
            course_id,
            user_id
        )
        .fetch_one(tx.as_mut())
        .await?;

        if !result.course_exists {
            return Err(LMSError::NotFound(format!(
                "Course with id {course_id} not found"
            )));
        }

        if !result.is_owner {
            return Err(LMSError::Forbidden(format!(
                "User is not the owner of course {course_id}"
            )));
        }

        sqlx::query!(
            r#"
            DELETE FROM courses
            WHERE id = $1
            "#,
            course_id
        )
        .execute(tx.as_mut())
        .await?;

        tx.commit().await?;

        Ok(())
    }

    async fn get_course_feed(&self, user_id: Uuid) -> Result<Vec<CourseModel>> {
        todo!()
    }

    async fn get_all_courses(&self) -> Result<Vec<CourseModel>> {
        let courses = sqlx::query_as!(
            CourseModel,
            r#"
            SELECT id, title, description, created_at
            FROM courses
            ORDER BY created_at DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(courses)
    }

    async fn get_course_by_id(&self, course_id: i32) -> Result<CourseModel> {
        let course = sqlx::query_as!(
            CourseModel,
            r#"
            SELECT id, title, description, created_at
            FROM courses
            WHERE id = $1
            "#,
            course_id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => LMSError::NotFound("Course not found".to_string()),
            _ => LMSError::DatabaseError(e),
        })?;

        Ok(course)
    }
}
