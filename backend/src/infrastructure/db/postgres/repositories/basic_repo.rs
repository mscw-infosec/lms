use crate::{
    domain::account::model::UserRole,
    domain::basic::{model::BasicUser, repository::BasicAuthRepository},
    errors::{LMSError, Result},
    infrastructure::db::postgres::RepositoryPostgres,
};
use async_trait::async_trait;
use uuid::Uuid;

#[async_trait]
impl BasicAuthRepository for RepositoryPostgres {
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

    async fn get_by_username(&self, username: &str) -> Result<Option<BasicUser>> {
        let user = sqlx::query!(
            r#"
                SELECT u.id, u.username, u.email, u.created_at,
                       ac.password_hash as password, u.role as "role: UserRole"
                FROM users u
                LEFT JOIN auth_credentials ac ON u.id = ac.user_id
                WHERE u.username = $1 AND ac.provider = 'basic'
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
            role: user.role,
            created_at: user.created_at,
        });

        Ok(user)
    }

    async fn update_ctfd_account(&self, user_id: Uuid, ctfd_user_id: i32) -> Result<()> {
        let _ = sqlx::query!(
            r#"
                UPDATE users SET ctfd_id = $1 WHERE id = $2
            "#,
            ctfd_user_id,
            user_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
