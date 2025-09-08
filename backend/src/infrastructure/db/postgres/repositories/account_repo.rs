use async_trait::async_trait;
use std::collections::HashMap;
use uuid::Uuid;

use crate::domain::task::model::{TaskConfig, TaskConfigStruct};
use crate::{
    domain::account::{
        model::{Attributes, UserModel, UserRole},
        repository::AccountRepository,
    },
    errors::{LMSError, Result},
    infrastructure::db::postgres::RepositoryPostgres,
};

#[async_trait]
impl AccountRepository for RepositoryPostgres {
    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserModel>> {
        let mut tx = self.pool.begin().await?;

        let attributes = sqlx::query!(
            r#"
                SELECT key, value
                FROM attributes
                WHERE user_id = $1
            "#,
            id
        )
        .fetch_all(tx.as_mut())
        .await
        .map(|x| {
            x.into_iter()
                .map(|row| (row.key, row.value))
                .collect::<HashMap<String, String>>()
        })?;

        let user = sqlx::query!(
            r#"
                SELECT u.id, u.username, u.email, u.created_at,
                       u.role as "role: UserRole", ac.password_hash as password
                FROM users u
                LEFT JOIN auth_credentials ac ON ac.user_id = u.id
                WHERE u.id = $1
            "#,
            id
        )
        .fetch_optional(tx.as_mut())
        .await?
        .map(|x| UserModel {
            id: x.id,
            username: x.username,
            email: x.email,
            role: x.role,
            password: x.password,
            attributes,
            created_at: x.created_at,
        });

        Ok(user)
    }

    async fn get_user_by_email(&self, email: String) -> Result<Option<UserModel>> {
        let mut tx = self.pool.begin().await?;

        let user = sqlx::query!(
            r#"
                SELECT u.id, u.username, u.email, u.created_at,
                       u.role as "role: UserRole", ac.password_hash as password
                FROM users u
                LEFT JOIN auth_credentials ac ON ac.user_id = u.id
                WHERE u.email = $1
            "#,
            email
        )
        .fetch_optional(tx.as_mut())
        .await?
        .map(|x| UserModel {
            id: x.id,
            username: x.username,
            email: x.email,
            role: x.role,
            password: x.password,
            attributes: Attributes::default(),
            created_at: x.created_at,
        });

        if let Some(mut new_user) = user {
            let attributes = sqlx::query!(
                r#"
                SELECT key, value
                FROM attributes
                WHERE user_id = $1
            "#,
                new_user.id
            )
            .fetch_all(tx.as_mut())
            .await
            .map(|x| {
                x.into_iter()
                    .map(|row| (row.key, row.value))
                    .collect::<HashMap<String, String>>()
            })?;
            new_user.attributes = attributes;
            return Ok(Some(new_user));
        }
        Ok(None)
    }

    async fn upsert_attributes(&self, id: Uuid, attributes: Attributes) -> Result<Attributes> {
        let (keys, values): (Vec<String>, Vec<String>) = attributes.into_iter().unzip();

        let _ = sqlx::query!(
            r#"
                INSERT INTO attributes (user_id, key, value)
                SELECT $1, key, value
                FROM UNNEST($2::text[], $3::text[]) AS x(key, value)
                ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
            "#,
            id,
            &keys,
            &values
        )
        .execute(&self.pool)
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(e) if e.is_foreign_key_violation() => {
                LMSError::NotFound("No user was found with that id.".to_string())
            }
            _ => LMSError::DatabaseError(err),
        })?;

        let attributes = sqlx::query!(
            r#"
                SELECT key, value
                FROM attributes
                WHERE user_id = $1
            "#,
            id
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|row| (row.key, row.value))
        .collect::<HashMap<String, String>>();

        Ok(attributes)
    }

    async fn get_user_active_ctfd_tasks(&self, user_id: Uuid) -> Result<Vec<usize>> {
        let tasks = sqlx::query_as!(
            TaskConfigStruct,
            r#"
                SELECT t.configuration
                FROM attempts a
                LEFT JOIN exam_tasks et ON et.exam_id = a.exam_id
                LEFT JOIN exams e ON e.id = a.exam_id
                LEFT JOIN tasks t ON t.id = et.task_id
                WHERE
                    a.user_id = $1 AND a.ends_at > NOW() AND
                    t.task_type = 'ctfd'
            "#,
            user_id
        )
        .fetch_all(&self.pool)
        .await?
        .iter()
        .map(|task_config| match task_config.configuration {
            TaskConfig::CTFd { task_id } => task_id,
            _ => unreachable!(),
        })
        .collect::<Vec<usize>>();

        Ok(tasks)
    }
}
