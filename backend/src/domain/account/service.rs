#![allow(unused_variables)]
use uuid::Uuid;

use super::{
    model::{Attributes, User, UserRole},
    repository::AccountRepository,
};
use crate::errors::{LMSError, Result};

pub struct AccountService {
    repo: Box<dyn AccountRepository + Send + Sync>,
}

impl AccountService {
    pub const fn new(repo: Box<dyn AccountRepository + Send + Sync>) -> Self {
        Self { repo }
    }

    pub async fn get_user(&self, id: Uuid) -> Result<User> {
        let Some(user) = self.repo.get_user_by_id(id).await? else {
            return Err(LMSError::NotFound(
                "No user was found with that id.".to_string(),
            ));
        };

        Ok(user)
    }

    pub fn change_password(&self, id: Uuid) -> Result<()> {
        todo!()
    }

    pub fn set_role(&self, id: Uuid, role: UserRole) -> Result<User> {
        todo!()
    }

    pub fn set_attributes(&self, id: Uuid, attributes: &Attributes) -> Result<User> {
        todo!()
    }
}
