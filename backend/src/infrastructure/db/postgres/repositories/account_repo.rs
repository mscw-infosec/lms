use std::collections::HashMap;

use async_trait::async_trait;
use uuid::Uuid;

use crate::errors::Result;
use crate::{
    domain::account::{
        model::{UserModel, UserRole},
        repository::AccountRepository,
    },
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
            x.iter()
                .map(|row| (row.key.clone(), row.value.clone()))
                .collect::<HashMap<String, String>>()
        })?;

        let user = sqlx::query!(
            r#"
            SELECT u.id, u.username, u.email, u.created_at, u.avatar_url,
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
            avatar_url: x.avatar_url,
            created_at: x.created_at,
        });

        Ok(user)
    }

    async fn update_avatar(&self, id: Uuid, avatar_path: &str) -> Result<()> {
        sqlx::query!(
            r#"
            UPDATE users
            SET avatar_url = $2
            WHERE id = $1
            "#,
            id,
            avatar_path
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
