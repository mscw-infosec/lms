use async_trait::async_trait;
use uuid::Uuid;

use crate::{
    domain::sso::{
        model::{NewSsoClient, SsoClient, SsoClientUpdate, SsoConsent},
        repository::SsoClientRepository,
    },
    errors::{LMSError, Result},
    infrastructure::db::postgres::RepositoryPostgres,
};

#[async_trait]
impl SsoClientRepository for RepositoryPostgres {
    async fn create_client(&self, client: &NewSsoClient) -> Result<SsoClient> {
        let created = sqlx::query_as!(
            SsoClient,
            r#"
                INSERT INTO sso_clients (
                    client_id, client_secret, name, description, logo_url,
                    redirect_uris, post_logout_redirect_uris, allowed_scopes,
                    is_public, skip_consent, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING
                    id, client_id, client_secret, name, description, logo_url,
                    redirect_uris, post_logout_redirect_uris, allowed_scopes,
                    is_public, skip_consent, enabled, created_by,
                    created_at, updated_at
            "#,
            client.client_id,
            client.client_secret_hash,
            client.name,
            client.description,
            client.logo_url,
            &client.redirect_uris,
            &client.post_logout_redirect_uris,
            &client.allowed_scopes,
            client.is_public,
            client.skip_consent,
            client.created_by,
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(created)
    }

    async fn get_client(&self, client_id: &str) -> Result<Option<SsoClient>> {
        let client = sqlx::query_as!(
            SsoClient,
            r#"
                SELECT
                    id, client_id, client_secret, name, description, logo_url,
                    redirect_uris, post_logout_redirect_uris, allowed_scopes,
                    is_public, skip_consent, enabled, created_by,
                    created_at, updated_at
                FROM sso_clients
                WHERE client_id = $1
            "#,
            client_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(client)
    }

    async fn list_clients(&self) -> Result<Vec<SsoClient>> {
        let clients = sqlx::query_as!(
            SsoClient,
            r#"
                SELECT
                    id, client_id, client_secret, name, description, logo_url,
                    redirect_uris, post_logout_redirect_uris, allowed_scopes,
                    is_public, skip_consent, enabled, created_by,
                    created_at, updated_at
                FROM sso_clients
                ORDER BY created_at DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(clients)
    }

    async fn update_client(&self, client_id: &str, update: &SsoClientUpdate) -> Result<SsoClient> {
        let updated = sqlx::query_as!(
            SsoClient,
            r#"
                UPDATE sso_clients
                SET name                      = COALESCE($2, name),
                    -- NULL leaves the field alone; '' clears it. Without the
                    -- second case an optional field could never be removed
                    -- again once it had been set.
                    description               = CASE
                                                    WHEN $3::TEXT IS NULL THEN description
                                                    ELSE NULLIF($3, '')
                                                END,
                    logo_url                  = CASE
                                                    WHEN $4::TEXT IS NULL THEN logo_url
                                                    ELSE NULLIF($4, '')
                                                END,
                    redirect_uris             = COALESCE($5, redirect_uris),
                    post_logout_redirect_uris = COALESCE($6, post_logout_redirect_uris),
                    allowed_scopes            = COALESCE($7, allowed_scopes),
                    skip_consent              = COALESCE($8, skip_consent),
                    enabled                   = COALESCE($9, enabled),
                    updated_at                = now()
                WHERE client_id = $1
                RETURNING
                    id, client_id, client_secret, name, description, logo_url,
                    redirect_uris, post_logout_redirect_uris, allowed_scopes,
                    is_public, skip_consent, enabled, created_by,
                    created_at, updated_at
            "#,
            client_id,
            update.name.as_deref(),
            update.description.as_deref(),
            update.logo_url.as_deref(),
            update.redirect_uris.as_deref(),
            update.post_logout_redirect_uris.as_deref(),
            update.allowed_scopes.as_deref(),
            update.skip_consent,
            update.enabled,
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| LMSError::NotFound("No SSO client with that client_id.".to_string()))?;

        Ok(updated)
    }

    async fn set_client_secret(&self, client_id: &str, secret_hash: &str) -> Result<()> {
        sqlx::query!(
            r#"
                UPDATE sso_clients
                SET client_secret = $2, updated_at = now()
                WHERE client_id = $1
            "#,
            client_id,
            secret_hash
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn delete_client(&self, client_id: &str) -> Result<()> {
        sqlx::query!(
            r#"
                DELETE FROM sso_clients WHERE client_id = $1
            "#,
            client_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_consent(&self, user_id: Uuid, client_id: &str) -> Result<Option<Vec<String>>> {
        let scopes = sqlx::query_scalar!(
            r#"
                SELECT scopes FROM sso_consents
                WHERE user_id = $1 AND client_id = $2
            "#,
            user_id,
            client_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(scopes)
    }

    async fn upsert_consent(
        &self,
        user_id: Uuid,
        client_id: &str,
        scopes: &[String],
    ) -> Result<()> {
        sqlx::query!(
            r#"
                INSERT INTO sso_consents (user_id, client_id, scopes)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, client_id) DO UPDATE
                SET scopes     = ARRAY(
                        SELECT DISTINCT unnest(sso_consents.scopes || EXCLUDED.scopes)
                    ),
                    granted_at = now()
            "#,
            user_id,
            client_id,
            scopes
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn list_consents(&self, user_id: Uuid) -> Result<Vec<SsoConsent>> {
        let consents = sqlx::query_as!(
            SsoConsent,
            r#"
                SELECT
                    c.client_id                 AS "client_id!",
                    cl.name                     AS "client_name!",
                    cl.logo_url                 AS "client_logo_url",
                    c.scopes                    AS "scopes!",
                    c.granted_at                AS "granted_at!"
                FROM sso_consents c
                JOIN sso_clients cl ON cl.client_id = c.client_id
                WHERE c.user_id = $1
                ORDER BY c.granted_at DESC
            "#,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(consents)
    }

    async fn delete_consent(&self, user_id: Uuid, client_id: &str) -> Result<()> {
        sqlx::query!(
            r#"
                DELETE FROM sso_consents
                WHERE user_id = $1 AND client_id = $2
            "#,
            user_id,
            client_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
