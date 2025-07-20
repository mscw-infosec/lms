use crate::domain::task::model::Task;
use crate::dto::task::CreateTaskRequestDTO;
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

    pub async fn create(&self, task: CreateTaskRequestDTO) -> Result<Task> {
        self.repo.create(task).await
    }
}
