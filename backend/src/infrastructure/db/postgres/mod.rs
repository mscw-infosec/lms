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

    /// Next free order index for a topic, shared across all content kinds
    /// (lectures, practices, exams, texts) so new items append to the end of
    /// the topic's single ordered sequence.
    pub async fn next_topic_order(&self, topic_id: i32) -> Result<i32, LMSError> {
        let next = sqlx::query_scalar!(
            r#"
                SELECT COALESCE(MAX(order_index) + 1, 0) AS "next!"
                FROM (
                    SELECT order_index FROM lecture_links WHERE topic_id = $1
                    UNION ALL
                    SELECT order_index FROM practices WHERE topic_id = $1
                    UNION ALL
                    SELECT order_index FROM exam_ordering WHERE topic_id = $1
                    UNION ALL
                    SELECT order_index FROM topic_texts WHERE topic_id = $1
                ) AS all_orders
            "#,
            topic_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(next)
    }
}
