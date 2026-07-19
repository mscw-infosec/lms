use crate::domain::account::model::UserRole;
use crate::domain::exam::model::ExamExtendedEntity;
use crate::domain::exam::service::ExamService;
use crate::domain::report::model::{
    AttemptStatus, ExportFile, Gradebook, GradebookRow, GradebookSummary, GradebookTask,
};
use crate::domain::report::repository::ReportRepository;
use crate::dto::exam::ScoringData;
use crate::dto::task::TaskVerdict;
use crate::errors::{LMSError, Result};
use crate::repo;
use chrono::Utc;
use rust_xlsxwriter::{Format, Workbook};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

const CSV_HEADER: &[&str] = &[
    "Username",
    "Email",
    "Score",
    "Max Score",
    "Percent",
    "Status",
    "Started At",
    "Submitted/Deadline",
];

#[derive(Clone)]
pub struct ReportService {
    exam_service: ExamService,
    repo: repo!(ReportRepository),
}

impl ReportService {
    pub fn new(exam_service: ExamService, repo: repo!(ReportRepository)) -> Self {
        Self { exam_service, repo }
    }

    fn attempt_score(scoring: &ScoringData) -> f64 {
        scoring.results.values().map(TaskVerdict::score).sum()
    }

    fn status_of(scoring: &ScoringData, window_open: bool) -> AttemptStatus {
        if window_open {
            AttemptStatus::InProgress
        } else if scoring
            .results
            .values()
            .any(|v| matches!(v, TaskVerdict::OnReview))
        {
            AttemptStatus::OnReview
        } else {
            AttemptStatus::Graded
        }
    }

    /// Builds the full gradebook for an exam: one row per attempt plus summary
    /// statistics. Requires the caller to have access to the exam.
    pub async fn exam_gradebook(
        &self,
        exam_id: Uuid,
        user: Uuid,
        role: UserRole,
    ) -> Result<Gradebook> {
        let exam = self.exam_service.get_exam(exam_id, user, role).await?;

        let entities = self.exam_service.get_entities(exam_id).await?;
        let tasks: Vec<GradebookTask> = entities
            .iter()
            .filter_map(|e| match e {
                ExamExtendedEntity::Task { task } => Some(GradebookTask {
                    id: task.id,
                    title: task.title.clone(),
                    max_score: task.points,
                }),
                ExamExtendedEntity::Text { .. } => None,
            })
            .collect();
        let max_score: i64 = tasks.iter().map(|t| t.max_score).sum();

        let attempts = self.exam_service.get_all_attempts_scored(exam_id).await?;

        let user_ids: Vec<Uuid> = attempts
            .iter()
            .map(|a| a.user_id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        let users = self.repo.get_users_by_ids(&user_ids).await?;
        let user_map: HashMap<Uuid, (String, String)> = users
            .into_iter()
            .map(|u| (u.id, (u.username, u.email)))
            .collect();

        let now = Utc::now();
        let rows: Vec<GradebookRow> = attempts
            .iter()
            .map(|a| {
                let (username, email) = user_map
                    .get(&a.user_id)
                    .cloned()
                    .unwrap_or_else(|| ("<unknown>".to_string(), String::new()));
                let window_open = a.ends_at > now;
                let task_scores = tasks
                    .iter()
                    .map(|task| {
                        #[allow(clippy::cast_sign_loss, clippy::cast_possible_truncation)]
                        let key = task.id as usize;
                        let score = a
                            .scoring_data
                            .results
                            .get(&key)
                            .map_or(0.0, |v| *TaskVerdict::score(v));
                        (task.id.to_string(), score)
                    })
                    .collect();
                GradebookRow {
                    user_id: a.user_id,
                    username,
                    email,
                    attempt_id: a.id,
                    started_at: a.started_at,
                    ends_at: a.ends_at,
                    score: Self::attempt_score(&a.scoring_data),
                    status: Self::status_of(&a.scoring_data, window_open),
                    task_scores,
                }
            })
            .collect();

        let summary = Self::summarize(&rows);

        Ok(Gradebook {
            exam_id,
            exam_name: exam.name,
            max_score,
            tasks,
            rows,
            summary,
        })
    }

    #[allow(clippy::cast_precision_loss)]
    fn summarize(rows: &[GradebookRow]) -> GradebookSummary {
        let total_attempts = rows.len();
        let participants = rows.iter().map(|r| r.user_id).collect::<HashSet<_>>().len();
        let graded = rows
            .iter()
            .filter(|r| r.status == AttemptStatus::Graded)
            .count();
        let on_review = rows
            .iter()
            .filter(|r| r.status == AttemptStatus::OnReview)
            .count();
        let in_progress = rows
            .iter()
            .filter(|r| r.status == AttemptStatus::InProgress)
            .count();

        // Averages/extremes consider only finished attempts (not in-progress).
        let finished: Vec<f64> = rows
            .iter()
            .filter(|r| r.status != AttemptStatus::InProgress)
            .map(|r| r.score)
            .collect();
        let average_score = if finished.is_empty() {
            0.0
        } else {
            finished.iter().sum::<f64>() / finished.len() as f64
        };
        let highest_score = finished.iter().copied().fold(0.0_f64, f64::max);
        let lowest_score = finished
            .iter()
            .copied()
            .fold(f64::INFINITY, f64::min)
            .min(highest_score);

        GradebookSummary {
            total_attempts,
            participants,
            graded,
            on_review,
            in_progress,
            average_score,
            highest_score,
            lowest_score: if finished.is_empty() {
                0.0
            } else {
                lowest_score
            },
        }
    }

    pub async fn exam_export(
        &self,
        exam_id: Uuid,
        user: Uuid,
        role: UserRole,
        format: ExportFormat,
    ) -> Result<ExportFile> {
        let gradebook = self.exam_gradebook(exam_id, user, role).await?;
        match format {
            ExportFormat::Csv => Ok(Self::build_csv(&gradebook)),
            ExportFormat::Xlsx => Self::build_xlsx(&gradebook),
        }
    }

    const fn status_label(status: AttemptStatus) -> &'static str {
        match status {
            AttemptStatus::InProgress => "In progress",
            AttemptStatus::OnReview => "On review",
            AttemptStatus::Graded => "Graded",
        }
    }

    #[allow(clippy::cast_precision_loss)]
    fn percent(score: f64, max_score: i64) -> f64 {
        if max_score > 0 {
            score / max_score as f64 * 100.0
        } else {
            0.0
        }
    }

    fn build_csv(gradebook: &Gradebook) -> ExportFile {
        let mut out = String::new();

        let mut headers: Vec<String> = CSV_HEADER.iter().map(ToString::to_string).collect();
        for task in &gradebook.tasks {
            headers.push(csv_escape(&format!("{} (/{})", task.title, task.max_score)));
        }
        out.push_str(&headers.join(","));
        out.push('\n');

        for row in &gradebook.rows {
            let mut fields = vec![
                csv_escape(&row.username),
                csv_escape(&row.email),
                format!("{:.2}", row.score),
                gradebook.max_score.to_string(),
                format!("{:.1}", Self::percent(row.score, gradebook.max_score)),
                Self::status_label(row.status).to_string(),
                row.started_at.to_rfc3339(),
                row.ends_at.to_rfc3339(),
            ];
            for task in &gradebook.tasks {
                let score = row
                    .task_scores
                    .get(&task.id.to_string())
                    .copied()
                    .unwrap_or(0.0);
                fields.push(format!("{score:.2}"));
            }
            out.push_str(&fields.join(","));
            out.push('\n');
        }

        ExportFile {
            bytes: out.into_bytes(),
            content_type: "text/csv; charset=utf-8",
            filename: format!("exam-{}-results.csv", gradebook.exam_id),
        }
    }

    #[allow(clippy::cast_possible_truncation)]
    #[allow(clippy::cast_precision_loss)]
    fn build_xlsx(gradebook: &Gradebook) -> Result<ExportFile> {
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        let bold = Format::new().set_bold();

        let xlsx_err =
            |e: rust_xlsxwriter::XlsxError| LMSError::ServerError(format!("XLSX error: {e}"));

        for (col, header) in CSV_HEADER.iter().enumerate() {
            worksheet
                .write_string_with_format(0, col as u16, *header, &bold)
                .map_err(xlsx_err)?;
        }
        let base_cols = CSV_HEADER.len() as u16;
        for (i, task) in gradebook.tasks.iter().enumerate() {
            worksheet
                .write_string_with_format(
                    0,
                    base_cols + i as u16,
                    format!("{} (/{})", task.title, task.max_score),
                    &bold,
                )
                .map_err(xlsx_err)?;
        }

        for (idx, row) in gradebook.rows.iter().enumerate() {
            let r = (idx + 1) as u32;
            worksheet
                .write_string(r, 0, &row.username)
                .map_err(xlsx_err)?;
            worksheet.write_string(r, 1, &row.email).map_err(xlsx_err)?;
            worksheet.write_number(r, 2, row.score).map_err(xlsx_err)?;
            worksheet
                .write_number(r, 3, gradebook.max_score as f64)
                .map_err(xlsx_err)?;
            worksheet
                .write_number(r, 4, Self::percent(row.score, gradebook.max_score))
                .map_err(xlsx_err)?;
            worksheet
                .write_string(r, 5, Self::status_label(row.status))
                .map_err(xlsx_err)?;
            worksheet
                .write_string(r, 6, row.started_at.to_rfc3339())
                .map_err(xlsx_err)?;
            worksheet
                .write_string(r, 7, row.ends_at.to_rfc3339())
                .map_err(xlsx_err)?;
            for (i, task) in gradebook.tasks.iter().enumerate() {
                let score = row
                    .task_scores
                    .get(&task.id.to_string())
                    .copied()
                    .unwrap_or(0.0);
                worksheet
                    .write_number(r, base_cols + i as u16, score)
                    .map_err(xlsx_err)?;
            }
        }

        let bytes = workbook.save_to_buffer().map_err(xlsx_err)?;

        Ok(ExportFile {
            bytes,
            content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename: format!("exam-{}-results.xlsx", gradebook.exam_id),
        })
    }
}

/// Which serialization to produce for an export.
#[derive(Debug, Clone, Copy)]
pub enum ExportFormat {
    Csv,
    Xlsx,
}

/// Quotes a CSV field if it contains a comma, quote or newline (RFC 4180).
pub(crate) fn csv_escape(field: &str) -> String {
    if field.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}
