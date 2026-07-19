use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenData {
    pub user_id: Uuid,
    /// Stable identifier for the device/session, generated at login and carried
    /// across token rotations so a session keeps its identity.
    pub device_id: String,
    /// Raw `User-Agent` of the client that created the session.
    #[serde(default)]
    pub user_agent: Option<String>,
    /// Human-friendly device label parsed from the user agent, e.g.
    /// "Chrome on Windows".
    #[serde(default)]
    pub device_label: String,
    /// Client IP the session was created from, if it could be determined.
    #[serde(default)]
    pub ip: Option<String>,
    pub issued_at: DateTime<Utc>,
    pub last_used: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub rotated: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SessionInfo {
    pub jti: Uuid,
    pub is_current: bool,
    pub device_id: String,
    /// Human-friendly device label, e.g. "Chrome on Windows".
    pub device_label: String,
    pub user_agent: Option<String>,
    pub ip: Option<String>,
    pub last_used: DateTime<Utc>,
    pub issued_at: DateTime<Utc>,
}

/// Device fingerprint captured when a session is created. Carried unchanged
/// across token rotations (only `last_used` advances).
#[derive(Debug, Clone)]
pub struct DeviceInfo {
    pub device_id: String,
    pub user_agent: Option<String>,
    pub device_label: String,
    pub ip: Option<String>,
}

impl DeviceInfo {
    /// Builds a fresh device fingerprint for a new login: a new `device_id`
    /// plus a label parsed from the user agent.
    pub fn new(user_agent: Option<String>, ip: Option<String>) -> Self {
        let device_label = parse_device_label(user_agent.as_deref());
        Self {
            device_id: Uuid::new_v4().to_string(),
            user_agent,
            device_label,
            ip,
        }
    }
}

impl From<RefreshTokenData> for DeviceInfo {
    /// Extracts the device fingerprint from a stored token so it can be carried
    /// to the rotated token.
    fn from(data: RefreshTokenData) -> Self {
        Self {
            device_id: data.device_id,
            user_agent: data.user_agent,
            device_label: data.device_label,
            ip: data.ip,
        }
    }
}

/// Derives a short, human-friendly label like "Chrome on Windows" from a
/// `User-Agent` string using simple substring heuristics. Returns
/// "Unknown device" when the user agent is missing or unrecognised.
#[must_use]
pub fn parse_device_label(user_agent: Option<&str>) -> String {
    let Some(ua) = user_agent else {
        return "Unknown device".to_string();
    };

    // Order matters: more specific tokens (Edge, Opera) must be checked before
    // the generic ones (Chrome, Safari) they also contain.
    let browser = if ua.contains("Edg") {
        Some("Edge")
    } else if ua.contains("OPR") || ua.contains("Opera") {
        Some("Opera")
    } else if ua.contains("Firefox") {
        Some("Firefox")
    } else if ua.contains("Chrome") || ua.contains("Chromium") {
        Some("Chrome")
    } else if ua.contains("Safari") {
        Some("Safari")
    } else {
        None
    };

    let os = if ua.contains("Windows") {
        Some("Windows")
    } else if ua.contains("iPhone") || ua.contains("iPad") || ua.contains("iOS") {
        Some("iOS")
    } else if ua.contains("Android") {
        Some("Android")
    } else if ua.contains("Mac OS") || ua.contains("Macintosh") {
        Some("macOS")
    } else if ua.contains("Linux") {
        Some("Linux")
    } else {
        None
    };

    match (browser, os) {
        (Some(b), Some(o)) => format!("{b} on {o}"),
        (Some(b), None) => b.to_string(),
        (None, Some(o)) => o.to_string(),
        (None, None) => "Unknown device".to_string(),
    }
}
