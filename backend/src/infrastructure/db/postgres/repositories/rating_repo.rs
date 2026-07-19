use crate::errors::LMSError;
use crate::{
    domain::{
        exam::model::ExamScoringPolicy,
        rating::{
            model::{CourseExamTask, CoursePracticeTask, CourseRef, PracticeSolve, RatingAttempt},
            repository::RatingRepository,
        },
        report::model::ReportUser,
    },
    errors::Result,
    infrastructure::db::postgres::RepositoryPostgres,
};
use async_trait::async_trait;
use uuid::Uuid;

#[async_trait]
impl RatingRepository for RepositoryPostgres {
    async fn course_exam_tasks(&self, course_id: i32) -> Result<Vec<CourseExamTask>> {
        let rows = sqlx::query_as!(
            CourseExamTask,
            r#"
                SELECT e.id                                        AS exam_id,
                       e.name                                      AS exam_name,
                       e.scoring_policy AS "scoring_policy: ExamScoringPolicy",
                       t.id                                        AS task_id,
                       t.points
                FROM topics tp
                    JOIN exams e ON e.topic_id = tp.id
                    JOIN exam_entities ee ON ee.exam_id = e.id AND ee.entity_type = 'task'
                    JOIN tasks t ON t.id = ee.task_id
                WHERE tp.course_id = $1
            "#,
            course_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn course_practice_tasks(&self, course_id: i32) -> Result<Vec<CoursePracticeTask>> {
        let rows = sqlx::query_as!(
            CoursePracticeTask,
            r#"
                SELECT p.id       AS practice_id,
                       p.title    AS practice_name,
                       t.id       AS task_id,
                       t.points
                FROM topics tp
                    JOIN practices p ON p.topic_id = tp.id
                    JOIN practice_tasks ptk ON ptk.practice_id = p.id
                    JOIN tasks t ON t.id = ptk.task_id
                WHERE tp.course_id = $1
            "#,
            course_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn course_exam_attempts(&self, course_id: i32) -> Result<Vec<RatingAttempt>> {
        let rows = sqlx::query_as!(
            RatingAttempt,
            r#"
                SELECT a.exam_id,
                       a.user_id,
                       a.started_at,
                       a.scoring_data AS "scoring_data: _"
                FROM attempts a
                    JOIN exams e ON e.id = a.exam_id
                    JOIN topics tp ON tp.id = e.topic_id
                WHERE tp.course_id = $1
            "#,
            course_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn course_practice_solves(&self, course_id: i32) -> Result<Vec<PracticeSolve>> {
        let rows = sqlx::query_as!(
            PracticeSolve,
            r#"
                SELECT DISTINCT pp.user_id, pp.task_id
                FROM practice_progress pp
                    JOIN practice_tasks ptk ON ptk.task_id = pp.task_id
                    JOIN practices p ON p.id = ptk.practice_id
                    JOIN topics tp ON tp.id = p.topic_id
                WHERE tp.course_id = $1
                  AND pp.solved = TRUE
            "#,
            course_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn course_participants(&self, course_id: i32) -> Result<Vec<ReportUser>> {
        let users = sqlx::query_as!(
            ReportUser,
            r#"
                SELECT u.id, u.username, u.email
                FROM users u
                WHERE u.id IN (
                    SELECT a.user_id
                    FROM attempts a
                        JOIN exams e ON e.id = a.exam_id
                        JOIN topics tp ON tp.id = e.topic_id
                    WHERE tp.course_id = $1
                    UNION
                    SELECT pp.user_id
                    FROM practice_progress pp
                        JOIN practice_tasks ptk ON ptk.task_id = pp.task_id
                        JOIN practices p ON p.id = ptk.practice_id
                        JOIN topics tp ON tp.id = p.topic_id
                    WHERE tp.course_id = $1 AND pp.solved = TRUE
                )
            "#,
            course_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(users)
    }

    async fn courses_with_activity(&self, user_id: Uuid) -> Result<Vec<i32>> {
        let rows = sqlx::query_scalar!(
            r#"
                SELECT tp.course_id AS "course_id!"
                FROM attempts a
                    JOIN exams e ON e.id = a.exam_id
                    JOIN topics tp ON tp.id = e.topic_id
                WHERE a.user_id = $1
                UNION
                SELECT tp.course_id
                FROM practice_progress pp
                    JOIN practice_tasks ptk ON ptk.task_id = pp.task_id
                    JOIN practices p ON p.id = ptk.practice_id
                    JOIN topics tp ON tp.id = p.topic_id
                WHERE pp.user_id = $1 AND pp.solved = TRUE
            "#,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn courses_by_ids(&self, ids: &[i32]) -> Result<Vec<CourseRef>> {
        let rows = sqlx::query_as!(
            CourseRef,
            r#"
                SELECT id, title
                FROM courses
                WHERE id = ANY($1)
            "#,
            ids
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn user_by_id(&self, id: Uuid) -> Result<ReportUser> {
        let user = sqlx::query_as!(
            ReportUser,
            r#"
                SELECT id, username, email
                FROM users
                WHERE id = $1
            "#,
            id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|err| match err {
            sqlx::Error::RowNotFound => {
                LMSError::NotFound("User with such id doesn't exist".to_string())
            }
            _ => LMSError::DatabaseError(err),
        })?;

        Ok(user)
    }
}
