pub mod repositories;

use redis::aio::MultiplexedConnection;

use crate::errors::Result;

#[derive(Clone)]
pub struct RepositoryRedis {
    conn: MultiplexedConnection,
}

impl RepositoryRedis {
    pub async fn new(redis_url: &str) -> Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let conn = client.get_multiplexed_tokio_connection().await?;
        Ok(Self { conn })
    }

    pub fn conn(&self) -> MultiplexedConnection {
        self.conn.clone()
    }
}
