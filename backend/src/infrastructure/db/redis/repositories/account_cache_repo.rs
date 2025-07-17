use crate::{
    domain::account::{model::UserModel, repository::AccountCacheRepository},
    errors::Result,
    infrastructure::db::redis::RepositoryRedis,
};
use async_trait::async_trait;
use redis::AsyncTypedCommands;
use uuid::Uuid;

#[async_trait]
impl AccountCacheRepository for RepositoryRedis {
    fn user_key(id: Uuid) -> String {
        format!("user:{id}")
    }

    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserModel>> {
        let mut conn = self.conn();
        let key = Self::user_key(id);

        let data_json: Option<String> = conn.get(key).await?;
        match data_json {
            Some(data) => Ok(Some(serde_json::from_str(&data)?)),
            None => Ok(None),
        }
    }

    async fn store_user(&self, user: &UserModel) -> Result<()> {
        let mut conn = self.conn();
        let key = Self::user_key(user.id);

        let value = serde_json::to_string(user)?;
        conn.set_ex(key, value, 24 * 60 * 60).await?;

        Ok(())
    }
}
