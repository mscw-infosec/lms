use crate::domain::task::model::Task;
use crate::dto::task::UpsertTaskRequestDTO;
use crate::errors::Result;
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
        self.repo.delete_task(task_id).await
    }

    pub async fn update_task(&self, task_id: i32, task_data: UpsertTaskRequestDTO) -> Result<Task> {
        self.repo.update_task(task_id, task_data).await
    }
}
