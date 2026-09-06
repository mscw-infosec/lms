use base64::{Engine, prelude::BASE64_URL_SAFE_NO_PAD};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use rsa::{
    RsaPrivateKey, RsaPublicKey,
    pkcs1::DecodeRsaPrivateKey,
    pkcs8::{DecodePrivateKey, EncodePrivateKey, EncodePublicKey, LineEnding},
    traits::PublicKeyParts,
};
use serde::{Serialize, de::DeserializeOwned};
use sha2::{Digest, Sha256};
use tracing::warn;

use crate::errors::{LMSError, Result};

#[derive(Clone)]
pub struct SsoKeys {
    encoding: EncodingKey,
    decoding: DecodingKey,
    kid: String,
    modulus: String,
    exponent: String,
}

impl SsoKeys {
    pub fn from_pem(pem: &str) -> Result<Self> {
        let key = RsaPrivateKey::from_pkcs8_pem(pem)
            .or_else(|_| RsaPrivateKey::from_pkcs1_pem(pem))
            .map_err(|e| {
                LMSError::ServerError(format!(
                    "SSO signing key is not a valid RSA private key: {e}"
                ))
            })?;

        if key.size() < 256 {
            return Err(LMSError::ServerError(
                "SSO signing key must be at least 2048 bits".to_string(),
            ));
        }

        Self::from_key(&key)
    }

    /// dev only
    pub fn generate_ephemeral() -> Result<Self> {
        warn!(
            "No SSO_PRIVATE_KEY configured - generating an ephemeral RSA key. \
             Tokens will not survive a restart and will not verify across replicas. \
             Set SSO_PRIVATE_KEY (or SSO_PRIVATE_KEY_FILE) in any real deployment."
        );

        let key = RsaPrivateKey::new(&mut rsa::rand_core::OsRng, 2048)
            .map_err(|e| LMSError::ServerError(format!("Failed to generate SSO key: {e}")))?;

        Self::from_key(&key)
    }

    fn from_key(key: &RsaPrivateKey) -> Result<Self> {
        let pem = key
            .to_pkcs8_pem(LineEnding::LF)
            .map_err(|e| LMSError::ServerError(format!("Failed to encode SSO key: {e}")))?;

        let encoding = EncodingKey::from_rsa_pem(pem.as_bytes())?;

        let public = RsaPublicKey::from(key);
        let public_der = public
            .to_public_key_der()
            .map_err(|e| LMSError::ServerError(format!("Failed to encode SSO public key: {e}")))?;

        let modulus = BASE64_URL_SAFE_NO_PAD.encode(public.n().to_bytes_be());
        let exponent = BASE64_URL_SAFE_NO_PAD.encode(public.e().to_bytes_be());
        let decoding = DecodingKey::from_rsa_components(&modulus, &exponent)
            .map_err(LMSError::InvalidToken)?;

        let kid = BASE64_URL_SAFE_NO_PAD.encode(Sha256::digest(public_der.as_bytes()));

        Ok(Self {
            encoding,
            decoding,
            kid,
            modulus,
            exponent,
        })
    }

    #[must_use]
    pub fn kid(&self) -> &str {
        &self.kid
    }

    /// The public half in JWKS form, served at `/sso/jwks.json`
    #[must_use]
    pub fn jwks(&self) -> serde_json::Value {
        serde_json::json!({
            "keys": [{
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "kid": self.kid,
                "n": self.modulus,
                "e": self.exponent,
            }]
        })
    }

    pub fn sign<T: Serialize>(&self, claims: &T, typ: &str) -> Result<String> {
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(self.kid.clone());
        header.typ = Some(typ.to_string());

        encode(&header, claims, &self.encoding).map_err(LMSError::InvalidToken)
    }

    pub fn verify<T: DeserializeOwned>(&self, token: &str, issuer: &str) -> Result<T> {
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[issuer]);
        validation.validate_aud = false;

        decode::<T>(token, &self.decoding, &validation)
            .map(|data| data.claims)
            .map_err(|e| LMSError::Unauthorized(format!("Invalid SSO token - {e}")))
    }
}
