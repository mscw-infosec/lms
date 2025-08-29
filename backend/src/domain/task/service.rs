use crate::domain::exam::model::Exam;
use crate::domain::task::model::{CtfdTaskResponse, Task, TaskConfig};
use crate::dto::task::UpsertTaskRequestDTO;
use crate::errors::{LMSError, Result};
use crate::utils::send_and_parse;
use crate::{domain::task::repository::TaskRepository, repo};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use std::sync::Arc;

pub const CTFD_API_URL: &str = "https://ctfd.infosec.moscow/api/v1";

#[derive(Clone)]
pub struct TaskService {
    repo: repo!(TaskRepository),
    http_client: reqwest::Client,
    ctfd_token: String,
}

impl TaskService {
    pub fn new(
        repo: repo!(TaskRepository),
        http_client: reqwest::Client,
        ctfd_token: String,
    ) -> Self {
        Self {
            repo,
            http_client,
            ctfd_token,
        }
    }

    pub async fn create_task(&self, mut task: UpsertTaskRequestDTO) -> Result<Task> {
        if let TaskConfig::CTFd { task_id } = task.configuration {
            let ctfd_task = self.get_ctfd_task_data(task_id).await?;
            if !ctfd_task.success {
                return Err(LMSError::NotFound("CTFd task not found".to_string()));
            }
            task.title = ctfd_task.data.name;
            task.description = Some(ctfd_task.data.description);
        }
        self.repo.create(task).await
    }

    pub async fn get_ctfd_task_data(&self, task_id: usize) -> Result<CtfdTaskResponse> {
        let ctfd_task = send_and_parse::<CtfdTaskResponse>(
            self.http_client
                .get(format!("{CTFD_API_URL}/challenges/{task_id}"))
                .header(CONTENT_TYPE, "application/json")
                .header(AUTHORIZATION, format!("Token {}", self.ctfd_token)),
            "CTFd task check",
        )
            .await;
        ctfd_task.map_or_else(|_| Err(LMSError::NotFound("Task not found in CTFd".to_string())), Ok)
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

    pub async fn update_task(
        &self,
        task_id: i32,
        mut task_data: UpsertTaskRequestDTO,
    ) -> Result<Task> {
        if !self.repo.get_exams(task_id).await?.is_empty() {
            // I'm not sure how messy things can get if user would edit task answers so
            // that there will be attempts with non-existent answers in database
            return Err(LMSError::Conflict(
                "You should remove this task from all the exams before editing it".to_string(),
            ));
        }
        if let TaskConfig::CTFd { task_id } = task_data.configuration {
            let ctfd_task = self.get_ctfd_task_data(task_id).await?;
            if !ctfd_task.success {
                return Err(LMSError::NotFound("CTFd task not found".to_string()));
            }
            task_data.title = ctfd_task.data.name;
            task_data.description = Some(ctfd_task.data.description);
        }
        self.repo.update_task(task_id, task_data).await
    }

    pub async fn get_tasks(&self, limit: i32, offset: i32) -> Result<Vec<Task>> {
        self.repo.get_tasks(limit, offset).await
    }
}
