use utoipa::openapi::security::{Http, HttpAuthScheme, SecurityScheme};
use utoipa::{Modify, OpenApi};

struct SecurityAddon;
impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components: &mut utoipa::openapi::Components = openapi
            .components
            .as_mut()
            .expect("shit happened at SecurityAddon");
        components.add_security_scheme(
            "bearerAuth",
            SecurityScheme::Http(Http::new(HttpAuthScheme::Bearer)),
        );
    }
}

#[derive(OpenApi)]
#[openapi(
    tags(
        (name = "Account", description = "User management"),
        (name = "Basic", description = "Auth using email and password"),
        (name = "OAuth", description = "OAuth providers with callback and login routes"),
    ),
    info(title = "LMS Passport Service"),
    modifiers(&SecurityAddon)
)]
pub struct ApiDoc;
