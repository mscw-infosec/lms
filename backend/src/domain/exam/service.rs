use crate::domain::exam::model::{Exam, ExamType};
use crate::domain::exam::repository::ExamRepository;
use crate::domain::task::model::{CtfdMetadataResponse, Task, TaskAnswer, TaskConfig, TaskType};
use crate::domain::task::service::CTFD_API_URL;
use crate::dto::exam::{ExamAttempt, ScoringData, UpsertExamRequestDTO};
use crate::dto::task::TaskVerdict;
use crate::errors::{LMSError, Result};
use crate::repo;
use crate::utils::send_and_parse;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use chrono::{Duration, Utc};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct ExamService {
    repo: repo!(ExamRepository),
    http_client: reqwest::Client,
    ctfd_token: String,
}

impl ExamService {
    pub fn new(
        repo: repo!(ExamRepository),
        http_client: reqwest::Client,
        ctfd_token: String,
    ) -> Self {
        Self {
            repo,
            http_client,
            ctfd_token,
        }
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
        let exam = self.get_exam(exam_id).await?;
        let mut attempts = self.repo.get_user_attempts(exam_id, user_id).await?;
        self.update_attempts_status(i64::from(exam.duration), &mut attempts)
            .await?;
        Ok(attempts)
    }

    pub async fn get_user_last_attempt(&self, exam_id: Uuid, user_id: Uuid) -> Result<ExamAttempt> {
        let exam = self.get_exam(exam_id).await?;
        let mut attempt = self.repo.get_user_last_attempt(exam_id, user_id).await?;
        let () = self
            .update_attempt_status(i64::from(exam.duration), &mut attempt)
            .await?;

        Ok(attempt)
    }

    pub async fn update_attempts_status(
        &self,
        exam_duration: i64,
        attempts: &mut Vec<ExamAttempt>,
    ) -> Result<()> {
        for attempt in attempts {
            let () = self.update_attempt_status(exam_duration, attempt).await?;
        }
        Ok(())
    }

    pub async fn update_attempt_status(
        &self,
        exam_duration: i64,
        attempt: &mut ExamAttempt,
    ) -> Result<()> {
        if attempt.active
            && exam_duration != 0
            && attempt.started_at + Duration::seconds(exam_duration) < Utc::now()
        {
            attempt.active = false;
            let () = self.repo.stop_attempt(attempt.id).await?;
            let _ = self.score_attempt(attempt.clone()).await?;
        }
        Ok(())
    }

    pub async fn start_exam(&self, exam_id: Uuid, user_id: Uuid) -> Result<ExamAttempt> {
        let exam = self.get_exam(exam_id).await?;
        let mut attempts = self.repo.get_user_attempts(exam_id, user_id).await?;
        let () = self
            .update_attempts_status(i64::from(exam.duration), &mut attempts)
            .await?;
        self.repo.start_exam(exam_id, user_id).await
    }

    pub async fn stop_exam(&self, exam_id: Uuid, user_id: Uuid) -> Result<()> {
        let attempt = self.get_user_last_attempt(exam_id, user_id).await?;
        if !attempt.active {
            return Err(LMSError::NotFound(
                "You have no active attempts".to_string(),
            ));
        }
        let () = self.repo.stop_attempt(attempt.id).await?;
        let _ = self.score_attempt(attempt).await?;
        Ok(())
    }

    #[allow(clippy::cast_possible_wrap)]
    pub async fn modify_attempt(
        &self,
        exam_id: Uuid,
        user_id: Uuid,
        task_id: usize,
        user_answer: TaskAnswer,
    ) -> Result<ExamAttempt> {
        let attempt = self.get_user_last_attempt(exam_id, user_id).await?;
        if !attempt.active {
            return Err(LMSError::NotFound(
                "You have no active attempts".to_string(),
            ));
        }
        let tasks = self.get_tasks(exam_id).await?;
        if let Some(task) = tasks.iter().find(|t| t.id == task_id as i64) {
            match (&task.configuration, user_answer.clone()) {
                (
                    TaskConfig::ShortText {
                        max_chars_count, ..
                    },
                    TaskAnswer::ShortText { answer },
                )
                | (
                    TaskConfig::LongText {
                        max_chars_count, ..
                    },
                    TaskAnswer::LongText { answer },
                ) => {
                    if answer.len() > *max_chars_count {
                        return Err(LMSError::ShitHappened(format!(
                            "Your answer length is more than allowed ({max_chars_count})"
                        )));
                    }
                    self.repo
                        .modify_attempt(exam_id, user_id, task_id, user_answer)
                        .await
                }
                (
                    TaskConfig::CTFd {
                        task_id: ctfd_task_id,
                    },
                    TaskAnswer::CTFd,
                ) => {
                    let ctfd_user_id = self.repo.get_user_ctfd_id(user_id).await?;
                    let solve_status = self
                        .check_if_ctfd_task_solved(*ctfd_task_id, ctfd_user_id)
                        .await?;
                    if solve_status {
                        self.repo
                            .modify_attempt(exam_id, user_id, task_id, user_answer)
                            .await
                    } else {
                        Err(LMSError::ShitHappened(
                            "You haven't solved this task yet".to_string(),
                        ))
                    }
                }
                (TaskConfig::SingleChoice { .. }, TaskAnswer::SingleChoice { .. })
                | (TaskConfig::MultipleChoice { .. }, TaskAnswer::MultipleChoice { .. })
                | (TaskConfig::Ordering { .. }, TaskAnswer::Ordering { .. })
                | (TaskConfig::FileUpload { .. }, TaskAnswer::FileUpload { .. }) => {
                    self.repo
                        .modify_attempt(exam_id, user_id, task_id, user_answer)
                        .await
                }
                _ => Err(LMSError::ShitHappened(
                    "You've sent an answer for another task type".to_string(),
                )),
            }
        } else {
            Err(LMSError::NotFound("This exam has no such task".to_string()))
        }
    }

    #[allow(clippy::too_many_lines)]
    #[allow(clippy::cast_possible_wrap)]
    #[allow(clippy::cast_precision_loss)]
    #[allow(clippy::cast_possible_truncation)]
    #[allow(clippy::cast_sign_loss)]
    pub async fn score_attempt(&self, mut attempt: ExamAttempt) -> Result<ScoringData> {
        let mut scoring_data = ScoringData {
            show_results: false,
            results: HashMap::default(),
        };
        let exam = self.get_exam(attempt.exam_id).await?;
        let tasks = self.get_tasks(attempt.exam_id).await?;
        let ctfd_user_id = self.repo.get_user_ctfd_id(attempt.user_id).await?;
        for ctfd_task in tasks
            .iter()
            .filter(|x| matches!(x.task_type, TaskType::CTFd))
        {
            if let TaskConfig::CTFd {
                task_id: ctfd_task_id,
            } = ctfd_task.configuration
            {
                let solve_status = self
                    .check_if_ctfd_task_solved(ctfd_task_id, ctfd_user_id)
                    .await?;
                if solve_status {
                    attempt
                        .answer_data
                        .answers
                        .insert(ctfd_task.id as usize, TaskAnswer::CTFd);
                }
            }
        }
        for (task_id, user_answer) in attempt.answer_data.answers.clone() {
            let task = tasks
                .iter()
                .find(|t| t.id == task_id as i64)
                .expect("There are answers for tasks that are not in exam");
            match (user_answer.clone(), &task.configuration) {
                (
                    TaskAnswer::SingleChoice { answer },
                    TaskConfig::SingleChoice {
                        options, correct, ..
                    },
                ) => {
                    if answer == options[*correct] {
                        scoring_data
                            .results
                            .insert(task_id, TaskVerdict::FullScore { comment: None });
                        continue;
                    }

                    scoring_data
                        .results
                        .insert(task_id, TaskVerdict::Incorrect { comment: None });
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
                    let correct_answers: HashSet<_> =
                        correct.iter().map(|&i| &options[i]).collect();
                    let user_answers: HashSet<_> = answers.iter().collect();

                    if user_answers == correct_answers {
                        scoring_data
                            .results
                            .insert(task_id, TaskVerdict::FullScore { comment: None });
                        continue;
                    }
                    if !partial_score {
                        scoring_data
                            .results
                            .insert(task_id, TaskVerdict::Incorrect { comment: None });
                        continue;
                    }

                    let correct_count = correct_answers.intersection(&user_answers).count() as f64;
                    let incorrect_count = user_answers.difference(&correct_answers).count() as f64;
                    // punish for wrong answers, not for missing
                    let score_multiplier =
                        (correct_count - incorrect_count) / correct_answers.len() as f64;
                    if score_multiplier <= 0f64 {
                        scoring_data
                            .results
                            .insert(task_id, TaskVerdict::Incorrect { comment: None });
                        continue;
                    }

                    scoring_data.results.insert(
                        task_id,
                        TaskVerdict::PartialScore {
                            score_multiplier,
                            comment: None,
                        },
                    );
                }

                (
                    TaskAnswer::ShortText { answer },
                    TaskConfig::ShortText {
                        answers,
                        auto_grade,
                        ..
                    },
                ) => {
                    if !auto_grade {
                        scoring_data.results.insert(task_id, TaskVerdict::OnReview);
                        continue;
                    }
                    if answers.contains(&answer) {
                        scoring_data
                            .results
                            .insert(task_id, TaskVerdict::FullScore { comment: None });
                    } else {
                        scoring_data
                            .results
                            .insert(task_id, TaskVerdict::Incorrect { comment: None });
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
                        scoring_data
                            .results
                            .insert(task_id, TaskVerdict::FullScore { comment: None });
                    } else {
                        scoring_data
                            .results
                            .insert(task_id, TaskVerdict::Incorrect { comment: None });
                    }
                }
                (TaskAnswer::LongText { .. }, TaskConfig::LongText { .. })
                | (TaskAnswer::FileUpload { .. }, TaskConfig::FileUpload { .. }) => {
                    scoring_data.results.insert(task_id, TaskVerdict::OnReview);
                }
                (TaskAnswer::CTFd, TaskConfig::CTFd { .. }) => {
                    // if answer exists then task is solved
                    scoring_data
                        .results
                        .insert(task_id, TaskVerdict::FullScore { comment: None });
                }
                _ => unreachable!(), // such cases (when TaskConfig type != TaskAnswer type) just shouldn't exist due to checks in modify_attempt
            }
        }

        if matches!(exam.r#type, ExamType::Instant) {
            scoring_data.show_results = true;
        }
        self.repo
            .update_attempt_score(attempt.id, &scoring_data)
            .await?;

        Ok(scoring_data)
    }

    pub async fn check_if_ctfd_task_solved(
        &self,
        task_id: usize,
        ctfd_user_id: i32,
    ) -> Result<bool> {
        let answer = send_and_parse::<CtfdMetadataResponse>(
            self.http_client
                .get(
                    CTFD_API_URL.to_owned()
                        + "/submissions?challenge_id="
                        + &task_id.to_string()
                        + "&user_id="
                        + &ctfd_user_id.to_string()
                        + "&type=correct",
                )
                .header(CONTENT_TYPE, "application/json")
                .header(AUTHORIZATION, format!("Token {}", self.ctfd_token)),
            "CTFd task solve status check",
        )
        .await?;
        if answer.meta.pagination.total == 0 {
            return Ok(false);
        }
        Ok(true)
    }
}
