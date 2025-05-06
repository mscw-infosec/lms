use std::collections::HashMap;

use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::account::{
    model::{User, UserRole},
    repository::AccountRepository,
};
use crate::errors::Result;

#[derive(Clone)]
pub struct AccountRepositoryPostgres {
    pub pool: PgPool,
}

#[async_trait]
impl AccountRepository for AccountRepositoryPostgres {
    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<User>> {
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
            x.iter()
                .map(|row| (row.key.clone(), row.value.clone()))
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
        .map(|x| User {
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
}
