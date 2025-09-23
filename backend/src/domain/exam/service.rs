use crate::domain::account::model::UserRole;
use crate::domain::exam::model::{Exam, ExamEntity, ExamExtendedEntity, ExamType, TextEntity};
use crate::domain::exam::repository::ExamRepository;
use crate::domain::task::model::{
    CtfdMetadataResponse, CtfdUsersReponse, TaskAnswer, TaskConfig, TaskType,
};
use crate::domain::task::service::CTFD_API_URL;
use crate::domain::topics::service::TopicService;
use crate::dto::exam::{ExamAttempt, ScoringData, UpsertExamRequestDTO};
use crate::dto::task::TaskVerdict;
use crate::errors::{LMSError, Result};
use crate::repo;
use crate::utils::send_and_parse;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use chrono::Utc;
use sqlx::types::Json;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct ExamService {
    repo: repo!(ExamRepository),
    http_client: reqwest::Client,
    ctfd_token: String,
    topic_service: TopicService,
}

impl ExamService {
    pub fn new(
        repo: repo!(ExamRepository),
        http_client: reqwest::Client,
        ctfd_token: String,
        topic_service: TopicService,
    ) -> Self {
        Self {
            repo,
            http_client,
            ctfd_token,
            topic_service,
        }
    }

    pub async fn create_exam(&self, exam: UpsertExamRequestDTO) -> Result<Exam> {
        self.repo.create(exam).await
    }

    pub async fn get_exam(&self, exam_id: Uuid, user: Uuid, role: UserRole) -> Result<Exam> {
        let exam = self.repo.get(exam_id).await?;
        let _ = self
            .topic_service
            .get_topic_by_id(user, role, exam.topic_id)
            .await?; // need it to check for access
        Ok(exam)
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

    pub async fn get_entities(&self, exam_id: Uuid) -> Result<Vec<ExamExtendedEntity>> {
        self.repo.get_entities(exam_id).await
    }

    pub async fn update_entities(&self, exam_id: Uuid, entities: Vec<ExamEntity>) -> Result<()> {
        if entities.iter().collect::<HashSet<_>>().len() != entities.len() {
            return Err(LMSError::Conflict(
                "You can use the same entity only once in an exam".to_string(),
            ));
        }
        self.repo.update_entities(exam_id, entities).await
    }

    pub async fn get_user_attempts(
        &self,
        exam_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<ExamAttempt>> {
        let mut attempts = self.repo.get_user_attempts(exam_id, user_id).await?;
        for attempt in &mut attempts {
            if attempt.ends_at <= Utc::now()
                && attempt.scoring_data.results.is_empty()
                && !attempt.answer_data.answers.is_empty()
            {
                let scoring = self.score_attempt(attempt.clone()).await?;
                attempt.scoring_data = Json(scoring);
            }
        }
        Ok(attempts)
    }

    pub async fn get_user_last_attempt(&self, exam_id: Uuid, user_id: Uuid) -> Result<ExamAttempt> {
        let mut attempt = self.repo.get_user_last_attempt(exam_id, user_id).await?;
        if attempt.ends_at <= Utc::now()
            && attempt.scoring_data.results.is_empty()
            && !attempt.answer_data.answers.is_empty()
        {
            let scoring = self.score_attempt(attempt.clone()).await?;
            attempt.scoring_data = Json(scoring);
        }
        Ok(attempt)
    }

    pub async fn start_exam(&self, exam_id: Uuid, user_id: Uuid) -> Result<ExamAttempt> {
        let user = self.repo.get_user_by_id(user_id).await?;
        let exam = self.get_exam(exam_id, user_id, user.role).await?;
        if let Some(starts_at) = exam.starts_at
            && starts_at > Utc::now()
        {
            return Err(LMSError::NotInTime("Exam hasn't started yet".to_string()));
        }
        if let Some(ends_at) = exam.ends_at
            && ends_at <= Utc::now()
        {
            return Err(LMSError::NotInTime("Exam has ended".to_string()));
        }
        self.repo.start_exam(exam_id, user_id).await
    }

    pub async fn stop_exam(&self, exam_id: Uuid, user_id: Uuid) -> Result<()> {
        let attempt = self.get_user_last_attempt(exam_id, user_id).await?;
        if attempt.ends_at <= Utc::now() {
            if attempt.scoring_data.results.is_empty() {
                let _ = self.score_attempt(attempt).await?;
            }
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
        if attempt.ends_at <= Utc::now() {
            return Err(LMSError::NotFound(
                "You have no active attempts".to_string(),
            ));
        }
        let entities = self.get_entities(exam_id).await?;
        let tasks = entities
            .iter()
            .filter_map(|e| match e {
                ExamExtendedEntity::Task { task } => Some(task),
                ExamExtendedEntity::Text { .. } => None,
            })
            .collect::<Vec<_>>();
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
                    let user = self.repo.get_user_by_id(attempt.user_id).await?;
                    let solve_status = self
                        .check_if_ctfd_task_solved(*ctfd_task_id, user.email)
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
        let user = self.repo.get_user_by_id(attempt.user_id).await?;
        let mut scoring_data = ScoringData {
            show_results: false,
            results: HashMap::default(),
        };
        let exam = self
            .get_exam(attempt.exam_id, attempt.user_id, user.role)
            .await?;
        let entities = self.get_entities(attempt.exam_id).await?;
        let tasks = entities
            .iter()
            .filter_map(|e| match e {
                ExamExtendedEntity::Task { task } => Some(task),
                ExamExtendedEntity::Text { .. } => None,
            })
            .collect::<Vec<_>>();
        for ctfd_task in tasks
            .iter()
            .filter(|x| matches!(x.task_type, TaskType::CTFd))
        {
            if let TaskConfig::CTFd {
                task_id: ctfd_task_id,
            } = ctfd_task.configuration
            {
                let solve_status = self
                    .check_if_ctfd_task_solved(ctfd_task_id, user.email.clone())
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
                        scoring_data.results.insert(
                            task_id,
                            TaskVerdict::FullScore {
                                comment: None,
                                score: task.points as f64,
                                max_score: task.points as f64,
                            },
                        );
                        continue;
                    }

                    scoring_data.results.insert(
                        task_id,
                        TaskVerdict::Incorrect {
                            comment: None,
                            score: 0f64,
                            max_score: task.points as f64,
                        },
                    );
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
                        scoring_data.results.insert(
                            task_id,
                            TaskVerdict::FullScore {
                                comment: None,
                                score: task.points as f64,
                                max_score: task.points as f64,
                            },
                        );
                        continue;
                    }
                    if !partial_score {
                        scoring_data.results.insert(
                            task_id,
                            TaskVerdict::Incorrect {
                                comment: None,
                                score: 0f64,
                                max_score: task.points as f64,
                            },
                        );
                        continue;
                    }

                    let correct_count = correct_answers.intersection(&user_answers).count() as f64;
                    let incorrect_count = user_answers.difference(&correct_answers).count() as f64;
                    // punish for wrong answers, not for missing
                    let score_multiplier =
                        (correct_count - incorrect_count) / correct_answers.len() as f64;
                    if score_multiplier <= 0f64 {
                        scoring_data.results.insert(
                            task_id,
                            TaskVerdict::Incorrect {
                                comment: None,
                                score: 0f64,
                                max_score: task.points as f64,
                            },
                        );
                        continue;
                    }

                    scoring_data.results.insert(
                        task_id,
                        TaskVerdict::PartialScore {
                            score: task.points as f64 * score_multiplier,
                            comment: None,
                            max_score: task.points as f64,
                        },
                    );
                }

                (
                    TaskAnswer::ShortText { answer },
                    TaskConfig::ShortText {
                        answers,
                        auto_grade,
                        case_sensitive,
                        ..
                    },
                ) => {
                    if !auto_grade {
                        scoring_data.results.insert(task_id, TaskVerdict::OnReview);
                        continue;
                    }
                    if *case_sensitive {
                        if answers.contains(&answer) {
                            scoring_data.results.insert(
                                task_id,
                                TaskVerdict::FullScore {
                                    comment: None,
                                    score: task.points as f64,
                                    max_score: task.points as f64,
                                },
                            );
                            continue;
                        }
                    } else {
                        let answer = answer.to_lowercase();
                        if answers
                            .iter()
                            .map(|x| x.to_lowercase())
                            .any(|x| x == answer)
                        {
                            scoring_data.results.insert(
                                task_id,
                                TaskVerdict::FullScore {
                                    comment: None,
                                    score: task.points as f64,
                                    max_score: task.points as f64,
                                },
                            );
                            continue;
                        }
                    }
                    scoring_data.results.insert(
                        task_id,
                        TaskVerdict::Incorrect {
                            comment: None,
                            score: 0f64,
                            max_score: task.points as f64,
                        },
                    );
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
                        scoring_data.results.insert(
                            task_id,
                            TaskVerdict::FullScore {
                                comment: None,
                                score: task.points as f64,
                                max_score: task.points as f64,
                            },
                        );
                    } else {
                        scoring_data.results.insert(
                            task_id,
                            TaskVerdict::Incorrect {
                                comment: None,
                                score: 0f64,
                                max_score: task.points as f64,
                            },
                        );
                    }
                }
                (TaskAnswer::LongText { .. }, TaskConfig::LongText { .. })
                | (TaskAnswer::FileUpload { .. }, TaskConfig::FileUpload { .. }) => {
                    scoring_data.results.insert(task_id, TaskVerdict::OnReview);
                }
                (TaskAnswer::CTFd, TaskConfig::CTFd { .. }) => {
                    // if answer exists then task is solved
                    scoring_data.results.insert(
                        task_id,
                        TaskVerdict::FullScore {
                            comment: None,
                            score: task.points as f64,
                            max_score: task.points as f64,
                        },
                    );
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

    pub async fn find_ctfd_id_by_email(&self, user_email: String) -> Result<i32> {
        let existent_user = send_and_parse::<CtfdUsersReponse>(
            self.http_client
                .get(format!(
                    "{CTFD_API_URL}/users?view=admin&field=email&q={user_email}"
                ))
                .header(CONTENT_TYPE, "application/json")
                .header(AUTHORIZATION, format!("Token {}", self.ctfd_token)),
            "CTFd user checking",
        )
        .await?;

        if existent_user.meta.pagination.total != 0 {
            return Ok(existent_user.data[0].id);
        }
        Err(LMSError::NotFound("CTFd user not found".to_string()))
    }

    pub async fn check_if_ctfd_task_solved(
        &self,
        task_id: usize,
        user_email: String,
    ) -> Result<bool> {
        let answer = send_and_parse::<CtfdMetadataResponse>(
            self.http_client
                .get(format!(
                    "{CTFD_API_URL}/submissions?challenge_id={task_id}&user_id={}&type=correct",
                    self.find_ctfd_id_by_email(user_email).await?
                ))
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

    pub async fn create_text(&self, text: String) -> Result<TextEntity> {
        self.repo.create_text(text).await
    }

    pub async fn update_text(&self, text_id: Uuid, text: String) -> Result<TextEntity> {
        self.repo.update_text(text_id, text).await
    }

    pub async fn delete_text(&self, text_id: Uuid) -> Result<()> {
        self.repo.delete_text(text_id).await
    }
}
