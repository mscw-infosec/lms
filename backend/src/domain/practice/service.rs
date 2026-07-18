use crate::domain::account::model::UserRole;
use crate::domain::practice::model::{
    PracticeModel, PracticeProgressModel, PracticeSummary, PracticeTaskRow,
};
use crate::domain::practice::repository::PracticeRepository;
use crate::domain::task::model::{Task, TaskAnswer, TaskConfig};
use crate::domain::task::service::TaskService;
use crate::domain::topics::service::TopicService;
use crate::dto::practice::{CreatePracticeRequestDTO, UpdatePracticeRequestDTO};
use crate::dto::task::{TaskVerdict, UpsertTaskRequestDTO};
use crate::errors::{LMSError, Result};
use crate::repo;
use serde_json::to_value;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct PracticeService {
    repo: repo!(PracticeRepository),
    task_service: TaskService,
    topic_service: TopicService,
}

impl PracticeService {
    pub fn new(
        repo: repo!(PracticeRepository),
        task_service: TaskService,
        topic_service: TopicService,
    ) -> Self {
        Self {
            repo,
            task_service,
            topic_service,
        }
    }

    /// Practice only makes sense for task types that can be graded automatically,
    /// since no one reviews practice submissions.
    const fn is_auto_gradable(config: &TaskConfig) -> bool {
        match config {
            TaskConfig::SingleChoice { .. }
            | TaskConfig::MultipleChoice { .. }
            | TaskConfig::Ordering { .. } => true,
            TaskConfig::ShortText { auto_grade, .. } => *auto_grade,
            TaskConfig::LongText { .. }
            | TaskConfig::FileUpload { .. }
            | TaskConfig::CTFd { .. } => false,
        }
    }

    async fn ensure_topic_access(&self, user: Uuid, role: UserRole, topic_id: i32) -> Result<()> {
        let _ = self
            .topic_service
            .get_topic_by_id(user, role, topic_id)
            .await?;
        Ok(())
    }

    /// Loads a practice and checks the caller may access its topic.
    async fn ensure_practice_access(
        &self,
        user: Uuid,
        role: UserRole,
        practice_id: i32,
    ) -> Result<PracticeModel> {
        let practice = self.repo.get_practice(practice_id).await?;
        self.ensure_topic_access(user, role, practice.topic_id)
            .await?;
        Ok(practice)
    }

    pub async fn create_practice(
        &self,
        user: Uuid,
        role: UserRole,
        practice: CreatePracticeRequestDTO,
    ) -> Result<PracticeModel> {
        self.ensure_topic_access(user, role, practice.topic_id)
            .await?;
        self.repo.create_practice(practice).await
    }

    pub async fn list_in_topic(
        &self,
        user: Uuid,
        role: UserRole,
        topic_id: i32,
    ) -> Result<Vec<PracticeSummary>> {
        self.ensure_topic_access(user, role, topic_id).await?;
        self.repo.list_in_topic(topic_id, user).await
    }

    pub async fn get_practice(
        &self,
        user: Uuid,
        role: UserRole,
        id: i32,
    ) -> Result<(PracticeModel, Vec<PracticeTaskRow>)> {
        let practice = self.ensure_practice_access(user, role, id).await?;
        let tasks = self.repo.list_tasks(id, user).await?;
        Ok((practice, tasks))
    }

    pub async fn get_practice_admin(
        &self,
        user: Uuid,
        role: UserRole,
        id: i32,
    ) -> Result<(PracticeModel, Vec<Task>)> {
        let practice = self.ensure_practice_access(user, role, id).await?;
        let tasks = self.repo.list_tasks_admin(id).await?;
        Ok((practice, tasks))
    }

    pub async fn update_practice(
        &self,
        user: Uuid,
        role: UserRole,
        id: i32,
        practice: UpdatePracticeRequestDTO,
    ) -> Result<PracticeModel> {
        self.ensure_practice_access(user, role, id).await?;
        self.repo.update_practice(id, practice).await
    }

    pub async fn delete_practice(&self, user: Uuid, role: UserRole, id: i32) -> Result<()> {
        self.ensure_practice_access(user, role, id).await?;
        self.repo.delete_practice(id).await
    }

    pub async fn create_task(
        &self,
        user: Uuid,
        role: UserRole,
        practice_id: i32,
        task: UpsertTaskRequestDTO,
    ) -> Result<Task> {
        self.ensure_practice_access(user, role, practice_id).await?;
        if !Self::is_auto_gradable(&task.configuration) {
            return Err(LMSError::ShitHappened(
                "Only auto-gradable tasks can be used for practice".to_string(),
            ));
        }
        let created = self.task_service.create_task(task).await?;
        let order = self.repo.next_task_order(practice_id).await?;
        #[allow(clippy::cast_possible_truncation)]
        self.repo
            .link_task(practice_id, created.id as i32, order)
            .await?;
        Ok(created)
    }

    pub async fn update_task(
        &self,
        user: Uuid,
        role: UserRole,
        practice_id: i32,
        task_id: i32,
        task: UpsertTaskRequestDTO,
    ) -> Result<Task> {
        self.ensure_practice_access(user, role, practice_id).await?;
        if !self.repo.task_in_practice(practice_id, task_id).await? {
            return Err(LMSError::NotFound(
                "Task is not part of this practice".to_string(),
            ));
        }
        if !Self::is_auto_gradable(&task.configuration) {
            return Err(LMSError::ShitHappened(
                "Only auto-gradable tasks can be used for practice".to_string(),
            ));
        }
        self.task_service.update_task(task_id, task).await
    }

    pub async fn remove_task(
        &self,
        user: Uuid,
        role: UserRole,
        practice_id: i32,
        task_id: i32,
    ) -> Result<()> {
        self.ensure_practice_access(user, role, practice_id).await?;
        self.repo.remove_task(practice_id, task_id).await
    }

    /// Grades a practice submission and records the attempt. Unlimited attempts.
    pub async fn submit(
        &self,
        user: Uuid,
        role: UserRole,
        task_id: i32,
        answer: TaskAnswer,
    ) -> Result<(TaskVerdict, PracticeProgressModel)> {
        // The task must be published as practice, and the user must have access
        // to at least one topic that offers it.
        let topic_ids = self.repo.get_practice_topic_ids(task_id).await?;
        if topic_ids.is_empty() {
            return Err(LMSError::NotFound(
                "This task is not available for practice".to_string(),
            ));
        }
        let mut has_access = false;
        for topic_id in topic_ids {
            if self.ensure_topic_access(user, role, topic_id).await.is_ok() {
                has_access = true;
                break;
            }
        }
        if !has_access {
            return Err(LMSError::Forbidden(
                "You do not have access to this practice task".to_string(),
            ));
        }

        let task = self.task_service.get_task(task_id).await?;
        task.validate_answer(&answer)?;
        let verdict = task.grade(&answer);
        let solved = matches!(verdict, TaskVerdict::FullScore { .. });

        let last_answer = to_value(&answer)
            .map_err(|e| LMSError::ShitHappened(format!("Failed to serialize answer: {e}")))?;
        let progress = self
            .repo
            .record_attempt(user, task_id, solved, last_answer)
            .await?;

        Ok((verdict, progress))
    }
}
