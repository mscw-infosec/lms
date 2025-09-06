pub mod repositories;

use crate::errors::LMSError;
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Postgres, migrate::Migrator, pool::PoolConnection};

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub async fn run_migrations(pool: &RepositoryPostgres) -> anyhow::Result<()> {
    MIGRATOR.run(&pool.client()).await?;
    Ok(())
}

#[derive(Clone)]
pub struct RepositoryPostgres {
    pool: PgPool,
}

impl RepositoryPostgres {
    pub async fn new(database_url: &str) -> Result<Self, LMSError> {
        Ok(Self {
            pool: PgPoolOptions::new()
                .test_before_acquire(true)
                .acquire_timeout(std::time::Duration::from_secs(5))
                .connect(database_url)
                .await?,
        })
    }

    pub fn client(&self) -> PgPool {
        self.pool.clone()
    }

    pub async fn conn(&self) -> Result<PoolConnection<Postgres>, LMSError> {
        self.pool.acquire().await.map_err(LMSError::DatabaseError)
    }
}
