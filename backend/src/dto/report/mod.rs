use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::domain::report::service::ExportFormat;

#[derive(Deserialize, Serialize, ToSchema, Validate)]
pub struct ExportQuery {
    #[serde(default)]
    pub format: ExportFormatDTO,
}

#[derive(Deserialize, Serialize, ToSchema, Default, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormatDTO {
    #[default]
    Csv,
    Xlsx,
}

impl From<ExportFormatDTO> for ExportFormat {
    fn from(value: ExportFormatDTO) -> Self {
        match value {
            ExportFormatDTO::Csv => Self::Csv,
            ExportFormatDTO::Xlsx => Self::Xlsx,
        }
    }
}
