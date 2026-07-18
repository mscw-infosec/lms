use crate::{
    domain::{
        practice::{
            model::{PracticeModel, PracticeProgressModel, PracticeSummary, PracticeTaskRow},
            repository::PracticeRepository,
        },
        task::model::{Task, TaskType},
    },
    dto::practice::{CreatePracticeRequestDTO, UpdatePracticeRequestDTO},
    errors::{LMSError, Result},
    infrastructure::db::postgres::RepositoryPostgres,
};
use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

#[async_trait]
impl PracticeRepository for RepositoryPostgres {
    async fn create_practice(&self, practice: CreatePracticeRequestDTO) -> Result<PracticeModel> {
        let order_index = self.next_topic_order(practice.topic_id).await?;
        let created = sqlx::query_as!(
            PracticeModel,
            r#"
                INSERT INTO practices (topic_id, title, description, order_index)
                VALUES ($1, $2, $3, $4)
                RETURNING id, topic_id, title, description, order_index
            "#,
            practice.topic_id,
            practice.title,
            practice.description,
            order_index
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(ref e) if e.is_foreign_key_violation() => {
                LMSError::NotFound("Topic not found".to_string())
            }
            _ => err.into(),
        })?;

        Ok(created)
    }

    async fn get_practice(&self, id: i32) -> Result<PracticeModel> {
        let practice = sqlx::query_as!(
            PracticeModel,
            r#"
                SELECT id, topic_id, title, description, order_index
                FROM practices
                WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| LMSError::NotFound("Practice not found".to_string()))?;

        Ok(practice)
    }

    async fn list_in_topic(&self, topic_id: i32, user_id: Uuid) -> Result<Vec<PracticeSummary>> {
        let practices = sqlx::query_as!(
            PracticeSummary,
            r#"
                SELECT p.id,
                       p.title,
                       p.description,
                       p.order_index,
                       COUNT(pt.task_id) AS "task_count!",
                       COUNT(pp.task_id) FILTER (WHERE pp.solved) AS "solved_count!"
                FROM practices p
                    LEFT JOIN practice_tasks pt ON pt.practice_id = p.id
                    LEFT JOIN practice_progress pp
                        ON pp.task_id = pt.task_id AND pp.user_id = $2
                WHERE p.topic_id = $1
                GROUP BY p.id
                ORDER BY p.order_index
            "#,
            topic_id,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(practices)
    }

    async fn update_practice(
        &self,
        id: i32,
        practice: UpdatePracticeRequestDTO,
    ) -> Result<PracticeModel> {
        // Ordering is managed by the topic's unified reorder, not here.
        let updated = sqlx::query_as!(
            PracticeModel,
            r#"
                UPDATE practices
                SET title = $1, description = $2
                WHERE id = $3
                RETURNING id, topic_id, title, description, order_index
            "#,
            practice.title,
            practice.description,
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| LMSError::NotFound("Practice not found".to_string()))?;

        Ok(updated)
    }

    async fn delete_practice(&self, id: i32) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        // Owned tasks are deleted first; this cascades their practice_tasks and
        // practice_progress rows.
        sqlx::query!(
            r#"
                DELETE FROM tasks
                WHERE id IN (SELECT task_id FROM practice_tasks WHERE practice_id = $1)
            "#,
            id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
                DELETE FROM practices
                WHERE id = $1
            "#,
            id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(())
    }

    async fn link_task(&self, practice_id: i32, task_id: i32, order_index: i32) -> Result<()> {
        sqlx::query!(
            r#"
                INSERT INTO practice_tasks (practice_id, task_id, order_index)
                VALUES ($1, $2, $3)
            "#,
            practice_id,
            task_id,
            order_index
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn next_task_order(&self, practice_id: i32) -> Result<i32> {
        let next = sqlx::query_scalar!(
            r#"
                SELECT COALESCE(MAX(order_index) + 1, 0) AS "next!"
                FROM practice_tasks
                WHERE practice_id = $1
            "#,
            practice_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(next)
    }

    async fn list_tasks(&self, practice_id: i32, user_id: Uuid) -> Result<Vec<PracticeTaskRow>> {
        let rows = sqlx::query_as!(
            PracticeTaskRow,
            r#"
                SELECT t.id,
                       t.title,
                       t.description,
                       t.task_type AS "task_type: TaskType",
                       t.points,
                       t.configuration,
                       pt.order_index,
                       COALESCE(pp.solved, FALSE) AS "solved!",
                       COALESCE(pp.attempts, 0) AS "attempts!"
                FROM practice_tasks pt
                    JOIN tasks t ON t.id = pt.task_id
                    LEFT JOIN practice_progress pp
                        ON pp.task_id = t.id AND pp.user_id = $2
                WHERE pt.practice_id = $1
                ORDER BY pt.order_index
            "#,
            practice_id,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn list_tasks_admin(&self, practice_id: i32) -> Result<Vec<Task>> {
        let tasks = sqlx::query_as!(
            Task,
            r#"
                SELECT t.id,
                       t.title,
                       t.description,
                       t.task_type AS "task_type: TaskType",
                       t.points,
                       t.configuration
                FROM practice_tasks pt
                    JOIN tasks t ON t.id = pt.task_id
                WHERE pt.practice_id = $1
                ORDER BY pt.order_index
            "#,
            practice_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(tasks)
    }

    async fn remove_task(&self, practice_id: i32, task_id: i32) -> Result<()> {
        sqlx::query!(
            r#"
                DELETE FROM tasks
                WHERE id = $2
                  AND EXISTS (
                      SELECT 1 FROM practice_tasks
                      WHERE practice_id = $1 AND task_id = $2
                  )
            "#,
            practice_id,
            task_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn task_in_practice(&self, practice_id: i32, task_id: i32) -> Result<bool> {
        let exists = sqlx::query_scalar!(
            r#"
                SELECT EXISTS(
                    SELECT 1 FROM practice_tasks
                    WHERE practice_id = $1 AND task_id = $2
                ) AS "exists!"
            "#,
            practice_id,
            task_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(exists)
    }

    async fn get_practice_topic_ids(&self, task_id: i32) -> Result<Vec<i32>> {
        let topic_ids = sqlx::query_scalar!(
            r#"
                SELECT DISTINCT p.topic_id
                FROM practice_tasks pt
                    JOIN practices p ON p.id = pt.practice_id
                WHERE pt.task_id = $1
            "#,
            task_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(topic_ids)
    }

    async fn record_attempt(
        &self,
        user_id: Uuid,
        task_id: i32,
        solved: bool,
        last_answer: Value,
    ) -> Result<PracticeProgressModel> {
        let progress = sqlx::query_as!(
            PracticeProgressModel,
            r#"
                INSERT INTO practice_progress (user_id, task_id, solved, attempts, last_answer)
                VALUES ($1, $2, $3, 1, $4)
                ON CONFLICT (user_id, task_id) DO UPDATE
                SET attempts = practice_progress.attempts + 1,
                    solved = practice_progress.solved OR EXCLUDED.solved,
                    last_answer = EXCLUDED.last_answer,
                    updated_at = now()
                RETURNING task_id, solved, attempts
            "#,
            user_id,
            task_id,
            solved,
            last_answer
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(progress)
    }
}
