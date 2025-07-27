use crate::domain::task::model::{Task, TaskAnswer, TaskConfig};
use crate::dto::task::{TaskAttempt, TaskVerdict, UpsertTaskRequestDTO};
use crate::errors::{LMSError, Result};
use crate::{domain::task::repository::TaskRepository, repo};
use std::collections::HashSet;
use std::sync::Arc;
use uuid::Uuid;

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

    pub async fn get_user_task_attempts(&self, task_id: i32, user_id: Uuid) -> Result<Vec<TaskAttempt>> {
        self.repo.get_user_attempts(task_id, user_id).await
    }

    #[allow(clippy::cast_possible_wrap)]
    pub async fn check_if_can_answer(&self, task_id: i32, user_id: Uuid) -> Result<bool> {
        let task = self.repo.get_task(task_id).await?;
        let user_attempts = self.get_user_task_attempts(task_id, user_id).await?;
        if task.tries_count != 0 && task.tries_count <= user_attempts.len() as i64 {
            return Ok(false);
        }
        Ok(true)
    }

    #[allow(clippy::cast_precision_loss)]
    #[allow(clippy::cast_possible_wrap)]
    pub async fn answer_task(&self, task_id: i32, user_id: Uuid, task_answer: TaskAnswer) -> Result<TaskVerdict> {
        let task = self.get_task(task_id).await?;
        match (task_answer.clone(), task.configuration) {
            (
                TaskAnswer::SingleChoice { answer },
                TaskConfig::SingleChoice { options, correct, .. }
            ) => {
                self.repo.answer_task(task_id, user_id, task_answer).await?;
                if answer == options[correct] {
                    return Ok(TaskVerdict::FullScore);
                }
                Ok(TaskVerdict::Incorrect)
            }

            (
                TaskAnswer::MultipleChoice { answers },
                TaskConfig::MultipleChoice { options, correct, partial_score, .. }
            ) => {
                self.repo.answer_task(task_id, user_id, task_answer).await?;
                let correct_answers: HashSet<_> = correct.iter().map(|&i| &options[i]).collect();
                let user_answers: HashSet<_> = answers.iter().collect();
                if user_answers == correct_answers {
                    Ok(TaskVerdict::FullScore)
                } else if partial_score {
                    let correct_count = correct_answers.intersection(&user_answers).count() as f64;
                    let incorrect_count = user_answers.difference(&correct_answers).count() as f64;
                    // punish for wrong answers, not for missing
                    let score_multiplier = (correct_count - incorrect_count) / correct_answers.len() as f64;
                    if score_multiplier <= 0f64 {
                        return Ok(TaskVerdict::Incorrect);
                    }
                    Ok(TaskVerdict::PartialScore { score_multiplier })
                } else {
                    Ok(TaskVerdict::Incorrect)
                }
            }

            (
                TaskAnswer::ShortText { answer },
                TaskConfig::ShortText { answers, .. }
            ) => {
                self.repo.answer_task(task_id, user_id, task_answer).await?;
                if answers.contains(&answer) {
                    Ok(TaskVerdict::FullScore)
                } else {
                    Ok(TaskVerdict::Incorrect)
                }
            }
            (
                TaskAnswer::Ordering { answer },
                TaskConfig::Ordering { items, answers }
            ) => {
                self.repo.answer_task(task_id, user_id, task_answer).await?;
                if answers.iter().any(|correct| correct.iter().map(|&i| &items[i]).cloned().collect::<Vec<String>>() == answer) {
                    Ok(TaskVerdict::FullScore)
                } else {
                    Ok(TaskVerdict::Incorrect)
                }
            }
            (
                TaskAnswer::LongText { .. },
                TaskConfig::LongText { .. }
            ) | (
                TaskAnswer::FileUpload { .. },
                TaskConfig::FileUpload { .. }
            ) => {
                self.repo.answer_task(task_id, user_id, task_answer).await?;
                Ok(TaskVerdict::OnReview)
            }
            _ => Err(LMSError::ShitHappened("You've sent an answer for another task".to_string()))
        }
    }
}
