use crate::domain::account::model::UserModel;
use crate::domain::exam::model::{Exam, ExamEntity, ExamExtendedEntity, TextEntity};
use crate::domain::task::model::TaskAnswer;
use crate::dto::exam::{ExamAttempt, ScoringData, UpsertExamRequestDTO};
use crate::dto::task::TaskVerdict;
use crate::errors::Result;
use crate::gen_openapi::DummyRepository;
use async_trait::async_trait;
use impl_unimplemented::impl_unimplemented;
use uuid::Uuid;

#[impl_unimplemented(DummyRepository)]
#[async_trait]
pub trait ExamRepository {
    async fn create(&self, exam_data: UpsertExamRequestDTO) -> Result<Exam>;
    async fn get(&self, id: Uuid) -> Result<Exam>;
    async fn update(&self, id: Uuid, exam_data: UpsertExamRequestDTO) -> Result<Exam>;
    async fn delete(&self, id: Uuid) -> Result<()>;
    async fn get_entities(&self, id: Uuid) -> Result<Vec<ExamExtendedEntity>>;
    async fn update_entities(&self, id: Uuid, tasks: Vec<ExamEntity>) -> Result<()>;
    async fn get_exam_attempts(
        &self,
        exam_id: Uuid,
        limit: i32,
        offset: i32,
    ) -> Result<Vec<ExamAttempt>>;
    async fn get_exam_unscored_attempts(&self, exam_id: Uuid) -> Result<Vec<ExamAttempt>>;
    async fn get_user_attempts_in_exam(&self, id: Uuid, user_id: Uuid) -> Result<Vec<ExamAttempt>>;
    async fn get_user_last_attempt_in_exam(&self, id: Uuid, user_id: Uuid) -> Result<ExamAttempt>;
    async fn stop_attempt(&self, attempt_id: Uuid) -> Result<()>;
    async fn start_exam(&self, id: Uuid, user_id: Uuid) -> Result<ExamAttempt>;
    async fn modify_attempt(
        &self,
        exam_id: Uuid,
        user_id: Uuid,
        task_id: usize,
        answer: TaskAnswer,
    ) -> Result<ExamAttempt>;
    async fn update_attempt_score(
        &self,
        attempt_id: Uuid,
        attempt_score: &ScoringData,
    ) -> Result<()>;
    async fn get_user_by_id(&self, user_id: Uuid) -> Result<UserModel>;
    async fn create_text(&self, text: String) -> Result<TextEntity>;
    async fn update_text(&self, id: Uuid, text: String) -> Result<TextEntity>;
    async fn delete_text(&self, id: Uuid) -> Result<()>;
    async fn get_text(&self, id: Uuid) -> Result<TextEntity>;
    async fn update_attempt_verdict(
        &self,
        attempt_id: Uuid,
        task_id: i32,
        verdict: TaskVerdict,
    ) -> Result<()>;
    async fn update_attempt_visibility_by_id(
        &self,
        attempt_id: Uuid,
        show_results: bool,
    ) -> Result<()>;
    async fn update_attempts_visibility_by_exam(
        &self,
        exam_id: Uuid,
        show_results: bool,
    ) -> Result<()>;
}
