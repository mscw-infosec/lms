use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::domain::practice::model::{
    PracticeModel, PracticeProgressModel, PracticeSummary, PracticeTaskRow,
};
use crate::domain::task::model::{Task, TaskSolution};
use crate::dto::task::{PublicTaskDTO, TaskVerdict};

#[derive(Deserialize, Serialize, Validate, ToSchema)]
pub struct CreatePracticeRequestDTO {
    #[validate(range(min = 0, message = "Topic id must be a non-negative integer"))]
    pub topic_id: i32,
    #[validate(length(
        min = 1,
        max = 200,
        message = "Title must be between 1 and 200 characters"
    ))]
    pub title: String,
    pub description: Option<String>,
    #[validate(range(min = 0, message = "Order index must be a non-negative integer"))]
    pub order_index: i32,
}

#[derive(Deserialize, Serialize, Validate, ToSchema)]
pub struct UpdatePracticeRequestDTO {
    #[validate(length(
        min = 1,
        max = 200,
        message = "Title must be between 1 and 200 characters"
    ))]
    pub title: String,
    pub description: Option<String>,
    #[validate(range(min = 0, message = "Order index must be a non-negative integer"))]
    pub order_index: i32,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct CreatePracticeResponseDTO {
    pub id: i32,
}

impl From<PracticeModel> for CreatePracticeResponseDTO {
    fn from(value: PracticeModel) -> Self {
        Self { id: value.id }
    }
}

/// A practice as shown in a topic list, with the caller's aggregate progress.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct PracticeSummaryDTO {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub order_index: i32,
    pub task_count: i64,
    pub solved_count: i64,
}

impl From<PracticeSummary> for PracticeSummaryDTO {
    fn from(value: PracticeSummary) -> Self {
        Self {
            id: value.id,
            title: value.title,
            description: value.description,
            order_index: value.order_index,
            task_count: value.task_count,
            solved_count: value.solved_count,
        }
    }
}

/// A practice task as shown to a learner: the public task (no answers) plus the
/// caller's own progress.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct PracticeTaskDTO {
    pub task: PublicTaskDTO,
    pub order_index: i32,
    pub solved: bool,
    pub attempts: i32,
    /// The correct answer, revealed only once the caller has solved the task so
    /// they can review it. `None` while unsolved or for non-reviewable types.
    pub solution: Option<TaskSolution>,
}

impl From<PracticeTaskRow> for PracticeTaskDTO {
    fn from(row: PracticeTaskRow) -> Self {
        let (task, order_index, solved, attempts) = row.into_task();
        let solution = if solved { task.solution() } else { None };
        Self {
            task: task.into(),
            order_index,
            solved,
            attempts,
            solution,
        }
    }
}

/// Full learner view of a practice: metadata plus its ordered tasks.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct PracticeDetailDTO {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub order_index: i32,
    pub tasks: Vec<PracticeTaskDTO>,
}

/// Teacher/editing view of a practice: metadata plus full tasks (with answers).
#[derive(Serialize, Deserialize, ToSchema)]
pub struct PracticeAdminDTO {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub order_index: i32,
    pub tasks: Vec<Task>,
}

/// Result of a single practice submission.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct PracticeSubmitResultDTO {
    pub verdict: TaskVerdict,
    pub solved: bool,
    pub attempts: i32,
    /// The correct answer, present only when the submission solved the task.
    pub solution: Option<TaskSolution>,
}

impl PracticeSubmitResultDTO {
    pub fn new(
        verdict: TaskVerdict,
        progress: &PracticeProgressModel,
        solution: Option<TaskSolution>,
    ) -> Self {
        Self {
            verdict,
            solved: progress.solved,
            attempts: progress.attempts,
            solution: if progress.solved { solution } else { None },
        }
    }
}
