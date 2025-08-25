use async_trait::async_trait;
use uuid::Uuid;

use crate::{
    domain::{
        account::model::UserRole,
        oauth::{
            model::{OAuth, OAuthUser},
            repository::OAuthRepository,
        },
    },
    errors::LMSError,
    infrastructure::db::postgres::RepositoryPostgres,
};

// FIX: this is awful implementation, fix it later

#[async_trait]
impl OAuthRepository for RepositoryPostgres {
    async fn find_by_email(&self, email: &str) -> Result<Option<Uuid>, LMSError> {
        let id = sqlx::query_scalar!(
            r#"
                SELECT id FROM users
                WHERE email = $1
            "#,
            email
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(id)
    }

    async fn create_user_with_provider(&self, user: &OAuthUser) -> Result<(), LMSError> {
        // FIX: this especially
        let mut tx = self.pool.begin().await?;

        sqlx::query!(
            r#"
                INSERT INTO users(id, username, email, role)
                VALUES ($1, $2, $3, $4)
            "#,
            user.id,
            user.username,
            user.email,
            user.role as UserRole,
        )
        .execute(tx.as_mut())
        .await?;

        sqlx::query!(
            r#"
                INSERT INTO auth_credentials(user_id, provider, provider_user_id)
                VALUES ($1, $2, $3)
            "#,
            user.id,
            user.provider.to_string(),
            user.provider_user_id
        )
        .execute(tx.as_mut())
        .await?;

        tx.commit().await?;

        Ok(())
    }

    async fn add_provider(&self, id: Uuid, provider: OAuth) -> Result<(), LMSError> {
        sqlx::query!(
            r#"
                INSERT INTO auth_credentials(user_id, provider, provider_user_id)
                VALUES ($1, $2, $3)
                ON CONFLICT
                DO NOTHING
            "#,
            id,
            provider.provider.to_string(),
            provider.client_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_ctfd_account(
        &self,
        user_id: Uuid,
        ctfd_user_id: i32,
    ) -> crate::errors::Result<()> {
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
