use crate::domain::report::model::ReportUser;
use crate::errors::Result;
use crate::gen_openapi::DummyRepository;
use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;
use uuid::Uuid;

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait ReportRepository {
    /// Batch-fetches user identities for the given ids (order not guaranteed).
    async fn get_users_by_ids(&self, ids: &[Uuid]) -> Result<Vec<ReportUser>>;
}
