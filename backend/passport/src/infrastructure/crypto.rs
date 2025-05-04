use std::iter::repeat_with;

use crate::errors::LMSError;

pub struct Argon;

impl Argon {
    pub fn hash_password(password: &[u8]) -> Result<String, LMSError> {
        let config = argon2::Config::original();
        let salt = Self::generate_bytes(16);

        argon2::hash_encoded(password, &salt, &config).map_err(LMSError::HashingError)
    }

    pub fn verify(password: &[u8], hash: &str) -> Result<bool, LMSError> {
        argon2::verify_encoded(hash, password).map_err(LMSError::HashingError)
    }

    fn generate_bytes(number: usize) -> Vec<u8> {
        repeat_with(|| fastrand::u8(..)).take(number).collect()
    }
}
