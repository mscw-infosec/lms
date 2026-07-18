use crate::domain::task::model::{Task, TaskConfig, TaskType};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;

/// A practice container as stored in the `practices` table.
#[derive(FromRow, Debug)]
pub struct PracticeModel {
    pub id: i32,
    pub topic_id: i32,
    pub title: String,
    pub description: Option<String>,
    pub order_index: i32,
}

/// A practice as seen in a topic listing: metadata plus aggregate counts for
/// the requesting user.
#[derive(FromRow, Debug)]
pub struct PracticeSummary {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub order_index: i32,
    pub task_count: i64,
    pub solved_count: i64,
}

/// A task inside a practice: the full task row plus its order and the requesting
/// user's progress. Field types mirror [`Task`] so the row can be split off.
#[derive(FromRow)]
pub struct PracticeTaskRow {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub task_type: TaskType,
    pub points: i64,
    pub configuration: TaskConfig,
    pub order_index: i32,
    pub solved: bool,
    pub attempts: i32,
}

impl PracticeTaskRow {
    /// Splits off the plain [`Task`] part (used to build the public projection).
    pub fn into_task(self) -> (Task, i32, bool, i32) {
        (
            Task {
                id: self.id,
                title: self.title,
                description: self.description,
                task_type: self.task_type,
                points: self.points,
                configuration: self.configuration,
            },
            self.order_index,
            self.solved,
            self.attempts,
        )
    }
}

/// Per-user progress for a single practice task.
#[derive(FromRow, Serialize, Deserialize, Debug)]
pub struct PracticeProgressModel {
    pub task_id: i32,
    pub solved: bool,
    pub attempts: i32,
}
