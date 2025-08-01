use crate::domain::exam::model::Exam;
use crate::domain::task::model::{Task, TaskAnswer, TaskConfig};
use crate::dto::task::{TaskVerdict, UpsertTaskRequestDTO};
use crate::errors::{LMSError, Result};
use crate::{domain::task::repository::TaskRepository, repo};
use std::collections::HashSet;
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
        self.repo.delete_task(task_id).await // FIXME: order indexes in exam should be recalculated after deletion
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

    // #[allow(clippy::cast_possible_wrap)]
    // pub async fn check_if_can_answer(&self, task_id: i32, user_id: Uuid) -> Result<bool> {
    //     let task = self.repo.get_task(task_id).await?;
    //     let user_attempts = self.get_user_task_attempts(task_id, user_id).await?;
    //     if task.tries_count != 0 && task.tries_count <= user_attempts.len() as i64 {
    //         return Ok(false);
    //     }
    //     Ok(true)
    // }

    #[allow(clippy::cast_precision_loss)]
    #[allow(clippy::cast_possible_wrap)]
    pub async fn check_answer(&self, task_id: i32, task_answer: TaskAnswer) -> Result<TaskVerdict> {
        let task = self.get_task(task_id).await?;
        match (task_answer.clone(), task.configuration) {
            (
                TaskAnswer::SingleChoice { answer },
                TaskConfig::SingleChoice {
                    options, correct, ..
                },
            ) => {
                if answer == options[correct] {
                    return Ok(TaskVerdict::FullScore);
                }
                Ok(TaskVerdict::Incorrect)
            }

            (
                TaskAnswer::MultipleChoice { answers },
                TaskConfig::MultipleChoice {
                    options,
                    correct,
                    partial_score,
                    ..
                },
            ) => {
                let correct_answers: HashSet<_> = correct.iter().map(|&i| &options[i]).collect();
                let user_answers: HashSet<_> = answers.iter().collect();

                if user_answers == correct_answers {
                    return Ok(TaskVerdict::FullScore);
                }
                if !partial_score {
                    return Ok(TaskVerdict::Incorrect);
                }

                let correct_count = correct_answers.intersection(&user_answers).count() as f64;
                let incorrect_count = user_answers.difference(&correct_answers).count() as f64;
                // punish for wrong answers, not for missing
                let score_multiplier =
                    (correct_count - incorrect_count) / correct_answers.len() as f64;
                if score_multiplier <= 0f64 {
                    return Ok(TaskVerdict::Incorrect);
                }

                Ok(TaskVerdict::PartialScore { score_multiplier })
            }

            (TaskAnswer::ShortText { answer }, TaskConfig::ShortText { answers, .. }) => {
                if answers.contains(&answer) {
                    Ok(TaskVerdict::FullScore)
                } else {
                    Ok(TaskVerdict::Incorrect)
                }
            }
            (TaskAnswer::Ordering { answer }, TaskConfig::Ordering { items, answers }) => {
                let precomputed_answers: Vec<Vec<String>> = answers
                    .iter()
                    .map(|correct| correct.iter().map(|&i| items[i].clone()).collect())
                    .collect();
                if precomputed_answers
                    .iter()
                    .any(|precomputed| precomputed == &answer)
                {
                    Ok(TaskVerdict::FullScore)
                } else {
                    Ok(TaskVerdict::Incorrect)
                }
            }
            (TaskAnswer::LongText { .. }, TaskConfig::LongText { .. })
            | (TaskAnswer::FileUpload { .. }, TaskConfig::FileUpload { .. }) => {
                Ok(TaskVerdict::OnReview)
            }
            _ => Err(LMSError::ShitHappened(
                "You've sent an answer for another task".to_string(),
            )),
        }
    }
}
