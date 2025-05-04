use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    domain::basic::{model::User, repository::BasicAuthRepository},
    errors::{LMSError, Result},
};

#[derive(Clone)]
pub struct BasicAuthRepositoryPostgres {
    pub pool: PgPool,
}

#[async_trait]
impl BasicAuthRepository for BasicAuthRepositoryPostgres {
    async fn create(&self, user: &User) -> Result<()> {
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

    async fn delete(&self, user_id: Uuid) -> Result<()> {
        todo!()
    }

    async fn list(&self) -> Result<Vec<User>> {
        todo!()
    }

    async fn update(&self, user: &User) -> Result<()> {
        todo!()
    }
}
