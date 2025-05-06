use async_trait::async_trait;
use sqlx::PgPool;

use crate::{
    domain::basic::{model::BasicUser, repository::BasicAuthRepository},
    errors::{LMSError, Result},
};

#[derive(Clone)]
pub struct BasicAuthRepositoryPostgres {
    pub pool: PgPool,
}

#[async_trait]
impl BasicAuthRepository for BasicAuthRepositoryPostgres {
    async fn create(&self, user: &BasicUser) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        let _ = sqlx::query!(
            r#"
            INSERT INTO users(id, username, email, created_at)
            VALUES ($1, $2, $3, $4)
            "#,
            user.id,
            user.username,
            user.email,
            user.created_at
        )
        .execute(tx.as_mut())
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(e) if e.is_unique_violation() => {
                LMSError::Conflict("User with that email or username already exists.".to_string())
            }
            _ => LMSError::DatabaseError(err),
        })?;

        let _ = sqlx::query!(
            r#"
            INSERT INTO auth_credentials(user_id, provider, password_hash)
            VALUES ($1, $2, $3)
            "#,
            user.id,
            "basic",
            user.password
        )
        .execute(tx.as_mut())
        .await?;

        tx.commit().await?;

        Ok(())
    }

    async fn get_by_username(&self, username: &str) -> Result<Option<BasicUser>> {
        let user = sqlx::query!(
            r#"
            SELECT u.id, u.username, u.email, u.created_at,
                   ac.password_hash as password
            FROM users u
            LEFT JOIN auth_credentials ac ON u.id = ac.user_id
            WHERE u.username = $1 OR ac.provider = 'basic'
            "#,
            username
        )
        .fetch_optional(&self.pool)
        .await?
        .map(|user| BasicUser {
            id: user.id,
            username: user.username,
            email: user.email,
            password: user.password.expect("With Basic auth password exists"),
            created_at: user.created_at,
        });

        Ok(user)
    }

    async fn is_exists(&self, username: &str, email: &str) -> Result<bool> {
        let id = sqlx::query!(
            r#"
            SELECT id FROM users
            WHERE username = $1 OR email = $2
            "#,
            username,
            email
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(id.is_some())
    }
}
