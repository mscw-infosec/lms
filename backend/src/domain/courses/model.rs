use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ConditionOp {
    Eq,
    Neq,
    Gt,
    Gte,
    Lt,
    Lte,
    In,
    Nin,
}

#[derive(Serialize, Deserialize, Debug, ToSchema)]
#[serde(tag = "type", content = "content")]
pub enum AttributeFilter {
    Condition {
        key: String,
        op: ConditionOp,
        value: serde_json::Value,
    },
    #[schema(no_recursion)]
    And(Vec<AttributeFilter>),
    #[schema(no_recursion)]
    Or(Vec<AttributeFilter>),
}

impl<'r> sqlx::Decode<'r, sqlx::Postgres> for AttributeFilter {
    fn decode(
        value: <sqlx::Postgres as sqlx::Database>::ValueRef<'r>,
    ) -> Result<Self, sqlx::error::BoxDynError> {
        let mut buf = value.as_bytes()?;

        if value.format() == sqlx::postgres::PgValueFormat::Binary {
            assert_eq!(
                buf[0], 1,
                "unsupported JSONB format version {}; please open an issue (see https://docs.rs/sqlx-postgres/0.8.6/src/sqlx_postgres/types/json.rs.html#80)",
                buf[0]
            );

            buf = &buf[1..];
        }

        serde_json::from_slice(buf).map_err(Into::into)
    }
}

#[derive(FromRow, Debug)]
pub struct CourseModel {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub access_filter: Option<AttributeFilter>,
    pub created_at: DateTime<Utc>,
}

pub struct CourseOwner {
    pub course_id: i32,
    pub user_id: Uuid,
}
