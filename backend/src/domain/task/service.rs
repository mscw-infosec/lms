use crate::{domain::task::repository::TaskRepository, repo};
use std::sync::Arc;
use crate::dto::task::{CreateTaskRequestDTO, CreateTaskResponseDTO};
use crate::errors::Result;

#[derive(Clone)]
pub struct TaskService {
    repo: repo!(TaskRepository),
}

impl TaskService {
    pub fn new(repo: repo!(TaskRepository)) -> Self {
        Self { repo }
    }

    pub async fn create(&self, task: CreateTaskRequestDTO) -> Result<CreateTaskResponseDTO> {
        Ok(self.repo.create(task).await?.into())
    }
}
