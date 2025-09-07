use crate::{
    domain::account::{
        model::{Attributes, UserModel},
        repository::AccountCacheRepository,
    },
    errors::Result,
    infrastructure::db::redis::RepositoryRedis,
};
use async_trait::async_trait;
use redis::JsonAsyncCommands;
use uuid::Uuid;

#[async_trait]
impl AccountCacheRepository for RepositoryRedis {
    fn user_key(id: Uuid) -> String {
        format!("user:{id}")
    }

    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserModel>> {
        let mut conn = self.conn();
        let key = Self::user_key(id);

        Ok(conn.json_get(&key, "$").await?)
    }

    async fn store_user(&self, user: &UserModel) -> Result<()> {
        let mut conn = self.conn();
        let key = Self::user_key(user.id);

        let mut pipe = redis::pipe();

        pipe.atomic()
            .json_set(&key, "$", &user)?
            .expire(key, 24 * 60 * 60);

        pipe.query_async::<()>(&mut conn).await?;

        Ok(())
    }

    async fn update_attributes(&self, id: Uuid, attributes: Attributes) -> Result<()> {
        let mut conn = self.conn();
        let key = Self::user_key(id);

        let _ = conn
            .json_set::<_, _, _, ()>(&key, "$.attributes", &attributes)
            .await;

        Ok(())
    }
}
