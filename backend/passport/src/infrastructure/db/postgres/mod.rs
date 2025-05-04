pub mod repositories;

use crate::errors::LMSError;
use sqlx::{migrate::Migrator, pool::PoolConnection, PgPool, Postgres};

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub async fn run_migrations(pool: &PostgresClient) -> anyhow::Result<()> {
    MIGRATOR.run(&pool.client()).await?;
    Ok(())
}

#[derive(Clone)]
pub struct PostgresClient {
    client: PgPool,
}

impl PostgresClient {
    pub async fn new(database_url: &str) -> Result<Self, LMSError> {
        Ok(Self {
            client: PgPool::connect(database_url).await?,
        })
    }

    pub fn client(&self) -> PgPool {
        self.client.clone()
    }

    pub async fn conn(&self) -> Result<PoolConnection<Postgres>, LMSError> {
        self.client.acquire().await.map_err(LMSError::DatabaseError)
    }
}
