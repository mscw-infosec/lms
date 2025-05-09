use crate::{errors::LMSError, utils::generate_random_string};

pub struct Argon;

impl Argon {
    pub fn hash_password(password: &[u8]) -> Result<String, LMSError> {
        let config = argon2::Config::original();
        let salt = generate_random_string(16);

        argon2::hash_encoded(password, salt.as_bytes(), &config).map_err(LMSError::HashingError)
    }

    pub fn verify(password: &[u8], hash: &str) -> Result<bool, LMSError> {
        argon2::verify_encoded(hash, password).map_err(LMSError::HashingError)
    }
}
