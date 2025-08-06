use crate::domain::exam::model::Exam;
use crate::domain::task::model::Task;
use crate::dto::task::UpsertTaskRequestDTO;
use crate::errors::{LMSError, Result};
use crate::{domain::task::repository::TaskRepository, repo};
use std::sync::Arc;

#[derive(Clone)]
pub struct TaskService {
    repo: repo!(TaskRepository),
}

impl TaskService {
    pub fn new(repo: repo!(TaskRepository)) -> Self {
        Self { repo }
    }

    pub async fn create_task(&self, task: UpsertTaskRequestDTO) -> Result<Task> {
        self.repo.create(task).await
    }

    pub async fn get_task(&self, task_id: i32) -> Result<Task> {
        self.repo.get_task(task_id).await
    }

    pub async fn delete_task(&self, task_id: i32) -> Result<()> {
        let () = self.repo.delete_task(task_id).await?; // FIXME: order indexes in exam should be recalculated after deletion
        Ok(())
    }

    pub async fn get_exams(&self, task_id: i32) -> Result<Vec<Exam>> {
        self.repo.get_exams(task_id).await
    }

    pub async fn update_task(&self, task_id: i32, task_data: UpsertTaskRequestDTO) -> Result<Task> {
        if !self.repo.get_exams(task_id).await?.is_empty() {
            // I'm not sure how messy things can get if user would edit task answers so
            // that there will be attempts with non-existent answers in database
            return Err(LMSError::Conflict(
                "You should remove this task from all the exams before editing it".to_string(),
            ));
        }
        self.repo.update_task(task_id, task_data).await
    }
}
