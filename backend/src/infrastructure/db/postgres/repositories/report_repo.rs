use crate::{
    domain::report::{model::ReportUser, repository::ReportRepository},
    errors::Result,
    infrastructure::db::postgres::RepositoryPostgres,
};
use async_trait::async_trait;
use uuid::Uuid;

#[async_trait]
impl ReportRepository for RepositoryPostgres {
    async fn get_users_by_ids(&self, ids: &[Uuid]) -> Result<Vec<ReportUser>> {
        let users = sqlx::query_as!(
            ReportUser,
            r#"
                SELECT id, username, email
                FROM users
                WHERE id = ANY($1)
            "#,
            ids
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(users)
    }
}
