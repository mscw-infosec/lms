use crate::{
    domain::account::model::UserRole,
    domain::basic::{
        model::{BasicUser, TakenFields},
        repository::BasicAuthRepository,
    },
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
                INSERT INTO users(id, username, email, first_name, last_name, patronymic, email_verified, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
            "#,
            user.id,
            user.username,
            user.email,
            user.first_name,
            user.last_name,
            user.patronymic,
            user.created_at
        )
        .execute(tx.as_mut())
        .await
        .map_err(|err| match err {
            sqlx::Error::Database(e) if e.is_unique_violation() => {
                LMSError::Conflict("email_taken".to_string())
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

    async fn find_taken(&self, username: &str, email: &str) -> Result<TakenFields> {
        // Usernames are compared case-insensitively so "Ivan 2077" and
        // "ivan 2077" can't both be claimed.
        let row = sqlx::query!(
            r#"
                SELECT
                    EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)) AS "username!",
                    EXISTS(SELECT 1 FROM users WHERE email = $2) AS "email!"
            "#,
            username,
            email
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(TakenFields {
            username: row.username,
            email: row.email,
        })
    }

    async fn get_by_email(&self, email: &str) -> Result<Option<BasicUser>> {
        let user = sqlx::query!(
            r#"
                SELECT u.id, u.username, u.email, u.created_at,
                       u.first_name, u.last_name, u.patronymic, u.email_verified,
                       ac.password_hash as password, u.role as "role: UserRole"
                FROM users u
                LEFT JOIN auth_credentials ac ON u.id = ac.user_id
                WHERE u.email = $1 AND ac.provider = 'basic'
            "#,
            email
        )
        .fetch_optional(&self.pool)
        .await?
        .map(|user| BasicUser {
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name.unwrap_or_default(),
            last_name: user.last_name.unwrap_or_default(),
            patronymic: user.patronymic,
            email_verified: user.email_verified,
            password: user.password.expect("With Basic auth password exists"),
            role: user.role,
            created_at: user.created_at,
        });

        Ok(user)
    }

    async fn find_user_for_reset(&self, email: &str) -> Result<Option<(Uuid, String)>> {
        let row = sqlx::query!(
            r#"
                SELECT id, email
                FROM users
                WHERE LOWER(email) = LOWER($1)
            "#,
            email
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| (r.id, r.email)))
    }

    async fn set_password(&self, user_id: Uuid, password_hash: &str) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        // Update an existing basic credential first; if the user has none yet
        // (e.g. an OAuth-only account), insert one so they gain a password.
        let updated = sqlx::query!(
            r#"
                UPDATE auth_credentials
                SET password_hash = $2
                WHERE user_id = $1 AND provider = 'basic'
            "#,
            user_id,
            password_hash
        )
        .execute(tx.as_mut())
        .await?;

        if updated.rows_affected() == 0 {
            sqlx::query!(
                r#"
                    INSERT INTO auth_credentials (user_id, provider, password_hash)
                    VALUES ($1, 'basic', $2)
                "#,
                user_id,
                password_hash
            )
            .execute(tx.as_mut())
            .await?;
        }

        tx.commit().await?;

        Ok(())
    }
}
