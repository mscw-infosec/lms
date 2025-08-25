use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use chrono::Utc;
use rand::distr::Alphanumeric;
use rand::{Rng, rng};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use super::{model::BasicUser, repository::BasicAuthRepository};
use crate::domain::account::model::UserRole;
use crate::domain::task::model::{CtfdCreateUserResponse, CtfdUsersReponse};
use crate::domain::task::service::CTFD_API_URL;
use crate::utils::send_and_parse;
use crate::{
    errors::{LMSError, Result},
    infrastructure::crypto::Argon,
    repo,
};

#[derive(Clone)]
pub struct BasicAuthService {
    repo: repo!(BasicAuthRepository),
    http_client: reqwest::Client,
    ctfd_token: String,
}

impl BasicAuthService {
    pub const fn new(
        repo: repo!(BasicAuthRepository),
        http_client: reqwest::Client,
        ctfd_token: String,
    ) -> Self {
        Self {
            repo,
            http_client,
            ctfd_token,
        }
    }

    pub async fn register(
        &self,
        username: String,
        email: String,
        password: String,
    ) -> Result<BasicUser> {
        let password_hash = Argon::hash_password(password.as_bytes())?;

        if self.repo.is_exists(&username, &email).await? {
            return Err(LMSError::Conflict(
                "User with that email or username already exists.".to_string(),
            ));
        }

        let user = BasicUser {
            id: Uuid::new_v4(),
            username: username.clone(),
            email: email.clone(),
            role: UserRole::default(),
            password: password_hash,
            created_at: Utc::now(),
        };

        self.repo.create(&user).await?;
        self.get_or_create_ctfd_account(user.id, username, password, email)
            .await?;
        Ok(user)
    }

    pub async fn login(&self, username: String, password: String) -> Result<BasicUser> {
        let Some(user) = self.repo.get_by_username(&username).await? else {
            return Err(LMSError::Forbidden(
                "Wrong username or password.".to_string(),
            ));
        };

        if !Argon::verify(password.as_bytes(), &user.password)? {
            return Err(LMSError::Forbidden(
                "Wrong username or password.".to_string(),
            ));
        }

        Ok(user)
    }

    pub async fn get_or_create_ctfd_account(
        &self,
        user_id: Uuid,
        username: String,
        password: String,
        email: String,
    ) -> Result<i32> {
        let mut ctfd_username = username.clone();

        let existent_user = send_and_parse::<CtfdUsersReponse>(
            self.http_client
                .get(CTFD_API_URL.to_owned() + "/users?view=admin&field=email&q=" + &email)
                .header(CONTENT_TYPE, "application/json")
                .header(AUTHORIZATION, format!("Token {}", self.ctfd_token)),
            "CTFd user checking",
        )
        .await?;

        if existent_user.meta.pagination.total != 0 {
            self.repo
                .update_ctfd_account(user_id, existent_user.data[0].id)
                .await?;
            return Ok(existent_user.data[0].id);
        }

        let user_with_same_name = send_and_parse::<CtfdUsersReponse>(
            self.http_client
                .get(CTFD_API_URL.to_owned() + "/users?view=admin&field=name&q=" + &username)
                .header(CONTENT_TYPE, "application/json")
                .header(AUTHORIZATION, format!("Token {}", self.ctfd_token)),
            "CTFd user name checking",
        )
        .await?;

        if user_with_same_name.meta.pagination.total != 0 {
            ctfd_username = username
                + "_"
                + rng()
                    .sample_iter(&Alphanumeric)
                    .take(6)
                    .map(char::from)
                    .collect::<String>()
                    .as_str();
        }

        let created_user = send_and_parse::<CtfdCreateUserResponse>(
            self.http_client
                .post(CTFD_API_URL.to_owned() + "/users?notify=true")
                .json(&json!({
                    "name": ctfd_username,
                    "email": email,
                    "password": password,
                    "verified": "false",
                    "hidden": "false",
                    "banned": "false",
                    "fields": Vec::<String>::new(),
                }))
                .header(ACCEPT, "application/json")
                .header(AUTHORIZATION, format!("Token {}", self.ctfd_token)),
            "CTFd user creating",
        )
        .await?;

        if !created_user.success {
            return Err(LMSError::ServerError(
                "Could not create CTFd account.".to_string(),
            ));
        }

        let ctfd_id = created_user
            .data
            .expect("Could not unwrap successful CTFd account data")
            .id;
        self.repo.update_ctfd_account(user_id, ctfd_id).await?;

        Ok(ctfd_id)
    }
}
