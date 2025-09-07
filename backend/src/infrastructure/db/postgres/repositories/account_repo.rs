use std::collections::HashMap;

use async_trait::async_trait;
use uuid::Uuid;

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
        });

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
}
