use crate::domain::exam::model::Exam;
use crate::domain::exam::repository::ExamRepository;
use crate::domain::task::model::Task;
use crate::dto::exam::{ExamAttempt, UpsertExamRequestDTO};
use crate::errors::{LMSError, Result};
use crate::repo;
use std::collections::HashSet;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct ExamService {
    repo: repo!(ExamRepository),
}

impl ExamService {
    pub fn new(repo: repo!(ExamRepository)) -> Self {
        Self { repo }
    }

    pub async fn create_exam(&self, exam: UpsertExamRequestDTO) -> Result<Exam> {
        self.repo.create(exam).await
    }

    pub async fn get_exam(&self, exam_id: Uuid) -> Result<Exam> {
        self.repo.get(exam_id).await
    }

    pub async fn delete_exam(&self, exam_id: Uuid) -> Result<()> {
        self.repo.delete(exam_id).await
    }

    pub async fn update_exam(
        &self,
        exam_id: Uuid,
        exam_data: UpsertExamRequestDTO,
    ) -> Result<Exam> {
        self.repo.update(exam_id, exam_data).await
    }

    pub async fn get_tasks(&self, exam_id: Uuid) -> Result<Vec<Task>> {
        self.repo.get_tasks(exam_id).await
    }

    pub async fn update_tasks(&self, exam_id: Uuid, tasks: Vec<i32>) -> Result<()> {
        if tasks.iter().collect::<HashSet<_>>().len() != tasks.len() {
            return Err(LMSError::Conflict(
                "You can use tasks only once in exam".to_string(),
            ));
        }
        self.repo.update_tasks(exam_id, tasks).await
    }

    pub async fn get_user_attempts(
        &self,
        exam_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<ExamAttempt>> {
        self.repo.get_user_attempts(exam_id, user_id).await
    }

    #[allow(clippy::cast_possible_wrap)]
    pub async fn check_if_can_start_exam(&self, exam_id: Uuid, user_id: Uuid) -> Result<bool> {
        let exam = self.repo.get(exam_id).await?;
        let user_attempts = self.get_user_attempts(exam_id, user_id).await?;
        if user_attempts.iter().any(|att| att.active)
            || (exam.tries_count != 0 && i64::from(exam.tries_count) <= user_attempts.len() as i64)
        {
            return Ok(false);
        }
        Ok(true)
    }
}
