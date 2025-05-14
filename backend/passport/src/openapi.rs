use utoipa::openapi::security::{ApiKey, ApiKeyValue, HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::{Modify, OpenApi};

struct BearerAuthAddon;
impl Modify for BearerAuthAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components: &mut utoipa::openapi::Components = openapi
            .components
            .as_mut()
            .expect("shit happened at SecurityAddon");

        let scheme = SecurityScheme::Http(
            HttpBuilder::new()
                .scheme(HttpAuthScheme::Bearer)
                .bearer_format("JWT")
                .build(),
        );

        components.add_security_scheme("BearerAuth", scheme);
    }
}

struct CookieAuthAddon;
impl Modify for CookieAuthAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components: &mut utoipa::openapi::Components = openapi
            .components
            .as_mut()
            .expect("shit happened at CookieAuthAddon");
        let scheme = SecurityScheme::ApiKey(ApiKey::Cookie(ApiKeyValue::new("refresh_token")));
        components.add_security_scheme("CookieAuth", scheme);
    }
}

#[derive(OpenApi)]
#[openapi(
    tags(
        (name = "Account", description = "User management"),
        (name = "Basic", description = "Auth using email and password"),
        (name = "OAuth", description = "OAuth providers with callback and login routes"),
        (name = "Auth", description = "Token refresh and session management"),
    ),
    info(title = "LMS Passport Service"),
    modifiers(&BearerAuthAddon, &CookieAuthAddon)
)]
pub struct ApiDoc;
