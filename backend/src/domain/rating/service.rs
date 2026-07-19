use crate::domain::account::model::UserRole;
use crate::domain::courses::service::CourseService;
use crate::domain::exam::model::ExamScoringPolicy;
use crate::domain::rating::model::{CourseExamTask, CoursePracticeTask, RatingAttempt};
use crate::domain::rating::repository::RatingRepository;
use crate::domain::report::model::ExportFile;
use crate::domain::report::service::{ExportFormat, csv_escape};
use crate::dto::rating::{
    CourseLeaderboardDTO, CourseScoreDTO, CourseUserRatingDTO, LeaderboardEntryDTO,
    LeaderboardQuery, RatingBreakdownItemDTO, UserOverallRatingDTO,
};
use crate::errors::{LMSError, Result};
use crate::repo;
use rust_xlsxwriter::{Format, Workbook};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

/// A course's exams reduced to what the rating needs: the current task set (for
/// bounding earned score) plus the total and the scoring policy.
struct ExamAgg {
    id: Uuid,
    name: String,
    policy: ExamScoringPolicy,
    task_ids: HashSet<i32>,
    max: f64,
}

/// A course's practices reduced to per-task points and the total.
struct PracticeAgg {
    id: i32,
    name: String,
    task_points: HashMap<i32, i64>,
    max: f64,
}

/// Everything needed to compute any user's rating in a single course, fetched
/// once and reused across users.
struct CourseAggregate {
    max: f64,
    exams: Vec<ExamAgg>,
    practices: Vec<PracticeAgg>,
    attempts: Vec<RatingAttempt>,
    /// `(user_id, task_id)` pairs for solved practice tasks.
    solves: HashSet<(Uuid, i32)>,
}

/// A single cell in an export table.
enum Cell {
    Text(String),
    Num(f64),
}

#[derive(Clone)]
pub struct RatingService {
    course_service: CourseService,
    repo: repo!(RatingRepository),
}

impl RatingService {
    pub fn new(course_service: CourseService, repo: repo!(RatingRepository)) -> Self {
        Self {
            course_service,
            repo,
        }
    }

    #[allow(clippy::cast_precision_loss)]
    fn percent(earned: f64, max: f64) -> f64 {
        if max > 0.0 { earned / max * 100.0 } else { 0.0 }
    }

    fn ensure_self_or_staff(requester: Uuid, role: UserRole, target: Uuid) -> Result<()> {
        if requester == target || matches!(role, UserRole::Teacher | UserRole::Admin) {
            Ok(())
        } else {
            Err(LMSError::Forbidden(
                "You can only view your own rating".to_string(),
            ))
        }
    }

    /// Fetches all raw data for a course and folds it into a reusable aggregate.
    async fn build_aggregate(&self, course_id: i32) -> Result<CourseAggregate> {
        let exam_tasks: Vec<CourseExamTask> = self.repo.course_exam_tasks(course_id).await?;
        let practice_tasks: Vec<CoursePracticeTask> =
            self.repo.course_practice_tasks(course_id).await?;
        let attempts = self.repo.course_exam_attempts(course_id).await?;
        let solves_vec = self.repo.course_practice_solves(course_id).await?;

        let mut exam_map: HashMap<Uuid, ExamAgg> = HashMap::new();
        for row in exam_tasks {
            let entry = exam_map.entry(row.exam_id).or_insert_with(|| ExamAgg {
                id: row.exam_id,
                name: row.exam_name.clone(),
                policy: row.scoring_policy,
                task_ids: HashSet::new(),
                max: 0.0,
            });
            #[allow(clippy::cast_precision_loss)]
            if entry.task_ids.insert(row.task_id) {
                entry.max += row.points as f64;
            }
        }

        let mut practice_map: HashMap<i32, PracticeAgg> = HashMap::new();
        for row in practice_tasks {
            let entry = practice_map
                .entry(row.practice_id)
                .or_insert_with(|| PracticeAgg {
                    id: row.practice_id,
                    name: row.practice_name.clone(),
                    task_points: HashMap::new(),
                    max: 0.0,
                });
            #[allow(clippy::cast_precision_loss)]
            if entry.task_points.insert(row.task_id, row.points).is_none() {
                entry.max += row.points as f64;
            }
        }

        let mut exams: Vec<ExamAgg> = exam_map.into_values().collect();
        exams.sort_by(|a, b| a.name.cmp(&b.name));
        let mut practices: Vec<PracticeAgg> = practice_map.into_values().collect();
        practices.sort_by(|a, b| a.name.cmp(&b.name));

        let max =
            exams.iter().map(|e| e.max).sum::<f64>() + practices.iter().map(|p| p.max).sum::<f64>();
        let solves: HashSet<(Uuid, i32)> = solves_vec
            .into_iter()
            .map(|s| (s.user_id, s.task_id))
            .collect();

        Ok(CourseAggregate {
            max,
            exams,
            practices,
            attempts,
            solves,
        })
    }

    /// Total score of one attempt, counting only tasks still present in the exam
    /// (so earned can never exceed the current max). On-review verdicts score 0.
    #[allow(clippy::cast_possible_truncation, clippy::cast_possible_wrap)]
    fn attempt_score(attempt: &RatingAttempt, task_ids: &HashSet<i32>) -> f64 {
        attempt
            .scoring_data
            .results
            .iter()
            .filter(|(task_id, _)| task_ids.contains(&(**task_id as i32)))
            .map(|(_, verdict)| *verdict.score())
            .sum()
    }

    /// A user's score for one exam, collapsing their attempts by the exam's
    /// policy.
    #[allow(clippy::cast_precision_loss)]
    fn exam_earned(agg: &CourseAggregate, exam: &ExamAgg, user: Uuid) -> f64 {
        let scores: Vec<(chrono::DateTime<chrono::Utc>, f64)> = agg
            .attempts
            .iter()
            .filter(|a| a.user_id == user && a.exam_id == exam.id)
            .map(|a| (a.started_at, Self::attempt_score(a, &exam.task_ids)))
            .collect();

        if scores.is_empty() {
            return 0.0;
        }

        match exam.policy {
            ExamScoringPolicy::Best => scores.iter().map(|(_, s)| *s).fold(0.0, f64::max),
            ExamScoringPolicy::Latest => scores
                .iter()
                .max_by_key(|(started_at, _)| *started_at)
                .map_or(0.0, |(_, s)| *s),
            ExamScoringPolicy::Average => {
                scores.iter().map(|(_, s)| *s).sum::<f64>() / scores.len() as f64
            }
        }
    }

    /// A user's score for one practice: the points of every solved task.
    #[allow(clippy::cast_precision_loss)]
    fn practice_earned(agg: &CourseAggregate, practice: &PracticeAgg, user: Uuid) -> f64 {
        practice
            .task_points
            .iter()
            .filter(|(task_id, _)| agg.solves.contains(&(user, **task_id)))
            .map(|(_, points)| *points as f64)
            .sum()
    }

    /// A user's total earned score in a course plus a per-container breakdown.
    fn user_breakdown(agg: &CourseAggregate, user: Uuid) -> (f64, Vec<RatingBreakdownItemDTO>) {
        let mut items = Vec::new();
        let mut total = 0.0;

        for exam in &agg.exams {
            let earned = Self::exam_earned(agg, exam, user);
            total += earned;
            items.push(RatingBreakdownItemDTO {
                kind: "exam".to_string(),
                id: exam.id.to_string(),
                title: exam.name.clone(),
                earned,
                max: exam.max,
            });
        }
        for practice in &agg.practices {
            let earned = Self::practice_earned(agg, practice, user);
            total += earned;
            items.push(RatingBreakdownItemDTO {
                kind: "practice".to_string(),
                id: practice.id.to_string(),
                title: practice.name.clone(),
                earned,
                max: practice.max,
            });
        }

        (total, items)
    }

    // ---- public views -----------------------------------------------------

    /// A user's overall rating across every course they have activity in.
    pub async fn user_overall(
        &self,
        target: Uuid,
        requester: Uuid,
        role: UserRole,
    ) -> Result<UserOverallRatingDTO> {
        Self::ensure_self_or_staff(requester, role, target)?;

        let user = self.repo.user_by_id(target).await?;
        let course_ids = self.repo.courses_with_activity(target).await?;
        let title_map: HashMap<i32, String> = self
            .repo
            .courses_by_ids(&course_ids)
            .await?
            .into_iter()
            .map(|c| (c.id, c.title))
            .collect();

        let mut courses = Vec::new();
        let mut total_earned = 0.0;
        let mut total_max = 0.0;
        for course_id in course_ids {
            let agg = self.build_aggregate(course_id).await?;
            let (earned, _) = Self::user_breakdown(&agg, target);
            total_earned += earned;
            total_max += agg.max;
            courses.push(CourseScoreDTO {
                course_id,
                title: title_map.get(&course_id).cloned().unwrap_or_default(),
                earned,
                max: agg.max,
                percent: Self::percent(earned, agg.max),
            });
        }
        courses.sort_by(|a, b| b.earned.partial_cmp(&a.earned).unwrap_or(Ordering::Equal));

        Ok(UserOverallRatingDTO {
            user_id: user.id,
            username: user.username,
            email: user.email,
            total_earned,
            total_max,
            percent: Self::percent(total_earned, total_max),
            courses,
        })
    }

    /// Computes the full, globally-ranked leaderboard for a course. Teacher/
    /// admin only. Returns `(course title, max score, all ranked entries)`.
    async fn leaderboard_entries(
        &self,
        course_id: i32,
        requester: Uuid,
        role: UserRole,
    ) -> Result<(String, f64, Vec<LeaderboardEntryDTO>)> {
        if !matches!(role, UserRole::Teacher | UserRole::Admin) {
            return Err(LMSError::Forbidden(
                "Only teachers and admins can view a course leaderboard".to_string(),
            ));
        }
        let course = self
            .course_service
            .get_course_by_id(requester, role, course_id)
            .await?;

        let agg = self.build_aggregate(course_id).await?;
        let participants = self.repo.course_participants(course_id).await?;

        let mut entries: Vec<LeaderboardEntryDTO> = participants
            .into_iter()
            .map(|u| {
                let (earned, _) = Self::user_breakdown(&agg, u.id);
                LeaderboardEntryDTO {
                    rank: 0,
                    user_id: u.id,
                    username: u.username,
                    email: u.email,
                    earned,
                    max: agg.max,
                    percent: Self::percent(earned, agg.max),
                }
            })
            .collect();
        entries.sort_by(|a, b| b.earned.partial_cmp(&a.earned).unwrap_or(Ordering::Equal));
        for (idx, entry) in entries.iter_mut().enumerate() {
            entry.rank = idx + 1;
        }

        Ok((course.title, agg.max, entries))
    }

    /// A page of a course leaderboard. Ranks are global; `search` filters by
    /// username/email (rank preserved), and the result is paginated. Teacher/
    /// admin only.
    pub async fn course_leaderboard(
        &self,
        course_id: i32,
        requester: Uuid,
        role: UserRole,
        query: LeaderboardQuery,
    ) -> Result<CourseLeaderboardDTO> {
        let (title, max, entries) = self.leaderboard_entries(course_id, requester, role).await?;

        let needle = query
            .search
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_lowercase);
        let filtered: Vec<LeaderboardEntryDTO> = match needle {
            Some(ref n) => entries
                .into_iter()
                .filter(|e| {
                    e.username.to_lowercase().contains(n) || e.email.to_lowercase().contains(n)
                })
                .collect(),
            None => entries,
        };

        #[allow(clippy::cast_possible_wrap)]
        let total = filtered.len() as i64;
        #[allow(clippy::cast_sign_loss)]
        let page: Vec<LeaderboardEntryDTO> = filtered
            .into_iter()
            .skip(query.offset.max(0) as usize)
            .take(query.limit.max(0) as usize)
            .collect();

        Ok(CourseLeaderboardDTO {
            course_id,
            title,
            max,
            total,
            entries: page,
        })
    }

    /// One user's detailed rating within a single course.
    pub async fn course_user(
        &self,
        course_id: i32,
        target: Uuid,
        requester: Uuid,
        role: UserRole,
    ) -> Result<CourseUserRatingDTO> {
        Self::ensure_self_or_staff(requester, role, target)?;
        let course = self
            .course_service
            .get_course_by_id(requester, role, course_id)
            .await?;
        let user = self.repo.user_by_id(target).await?;

        let agg = self.build_aggregate(course_id).await?;
        let (earned, breakdown) = Self::user_breakdown(&agg, target);

        Ok(CourseUserRatingDTO {
            course_id,
            title: course.title,
            user_id: user.id,
            username: user.username,
            email: user.email,
            earned,
            max: agg.max,
            percent: Self::percent(earned, agg.max),
            breakdown,
        })
    }

    // ---- exports ----------------------------------------------------------

    pub async fn user_overall_export(
        &self,
        target: Uuid,
        requester: Uuid,
        role: UserRole,
        format: ExportFormat,
    ) -> Result<ExportFile> {
        let rating = self.user_overall(target, requester, role).await?;
        let headers = ["Course", "Earned", "Max", "Percent"];
        let mut rows: Vec<Vec<Cell>> = rating
            .courses
            .iter()
            .map(|c| {
                vec![
                    Cell::Text(c.title.clone()),
                    Cell::Num(c.earned),
                    Cell::Num(c.max),
                    Cell::Num(c.percent),
                ]
            })
            .collect();
        rows.push(vec![
            Cell::Text("Total".to_string()),
            Cell::Num(rating.total_earned),
            Cell::Num(rating.total_max),
            Cell::Num(rating.percent),
        ]);
        Self::export_table(
            format,
            &headers,
            &rows,
            &format!("rating-user-{}", rating.user_id),
        )
    }

    pub async fn course_leaderboard_export(
        &self,
        course_id: i32,
        requester: Uuid,
        role: UserRole,
        format: ExportFormat,
    ) -> Result<ExportFile> {
        // Export always covers the full leaderboard, never a single page.
        let (_, _, entries) = self.leaderboard_entries(course_id, requester, role).await?;
        let headers = ["Rank", "Username", "Email", "Earned", "Max", "Percent"];
        #[allow(clippy::cast_precision_loss)]
        let rows: Vec<Vec<Cell>> = entries
            .iter()
            .map(|e| {
                vec![
                    Cell::Num(e.rank as f64),
                    Cell::Text(e.username.clone()),
                    Cell::Text(e.email.clone()),
                    Cell::Num(e.earned),
                    Cell::Num(e.max),
                    Cell::Num(e.percent),
                ]
            })
            .collect();
        Self::export_table(
            format,
            &headers,
            &rows,
            &format!("rating-course-{course_id}-leaderboard"),
        )
    }

    pub async fn course_user_export(
        &self,
        course_id: i32,
        target: Uuid,
        requester: Uuid,
        role: UserRole,
        format: ExportFormat,
    ) -> Result<ExportFile> {
        let rating = self.course_user(course_id, target, requester, role).await?;
        let headers = ["Type", "Title", "Earned", "Max"];
        let mut rows: Vec<Vec<Cell>> = rating
            .breakdown
            .iter()
            .map(|item| {
                vec![
                    Cell::Text(item.kind.clone()),
                    Cell::Text(item.title.clone()),
                    Cell::Num(item.earned),
                    Cell::Num(item.max),
                ]
            })
            .collect();
        rows.push(vec![
            Cell::Text("Total".to_string()),
            Cell::Text(String::new()),
            Cell::Num(rating.earned),
            Cell::Num(rating.max),
        ]);
        Self::export_table(
            format,
            &headers,
            &rows,
            &format!("rating-course-{}-user-{}", course_id, rating.user_id),
        )
    }

    /// Renders a table to the requested format, reusing the shared CSV/XLSX
    /// helpers.
    fn export_table(
        format: ExportFormat,
        headers: &[&str],
        rows: &[Vec<Cell>],
        stem: &str,
    ) -> Result<ExportFile> {
        match format {
            ExportFormat::Csv => Ok(Self::table_csv(headers, rows, format!("{stem}.csv"))),
            ExportFormat::Xlsx => Self::table_xlsx(headers, rows, format!("{stem}.xlsx")),
        }
    }

    fn table_csv(headers: &[&str], rows: &[Vec<Cell>], filename: String) -> ExportFile {
        let mut out = String::new();
        out.push_str(
            &headers
                .iter()
                .map(|h| csv_escape(h))
                .collect::<Vec<_>>()
                .join(","),
        );
        out.push('\n');
        for row in rows {
            let fields: Vec<String> = row
                .iter()
                .map(|cell| match cell {
                    Cell::Text(s) => csv_escape(s),
                    Cell::Num(n) => format!("{n:.2}"),
                })
                .collect();
            out.push_str(&fields.join(","));
            out.push('\n');
        }
        ExportFile {
            bytes: out.into_bytes(),
            content_type: "text/csv; charset=utf-8",
            filename,
        }
    }

    #[allow(clippy::cast_possible_truncation)]
    fn table_xlsx(headers: &[&str], rows: &[Vec<Cell>], filename: String) -> Result<ExportFile> {
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        let bold = Format::new().set_bold();
        let xlsx_err =
            |e: rust_xlsxwriter::XlsxError| LMSError::ServerError(format!("XLSX error: {e}"));

        for (col, header) in headers.iter().enumerate() {
            worksheet
                .write_string_with_format(0, col as u16, *header, &bold)
                .map_err(xlsx_err)?;
        }
        for (r, row) in rows.iter().enumerate() {
            let r = (r + 1) as u32;
            for (col, cell) in row.iter().enumerate() {
                let col = col as u16;
                match cell {
                    Cell::Text(s) => worksheet.write_string(r, col, s).map_err(xlsx_err)?,
                    Cell::Num(n) => worksheet.write_number(r, col, *n).map_err(xlsx_err)?,
                };
            }
        }

        let bytes = workbook.save_to_buffer().map_err(xlsx_err)?;
        Ok(ExportFile {
            bytes,
            content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename,
        })
    }
}
