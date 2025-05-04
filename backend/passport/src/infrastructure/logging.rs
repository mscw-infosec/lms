use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub fn init_tracing() {
    tracing_subscriber::registry()
        .with(
            EnvFilter::from_default_env().add_directive(
                "axum=debug"
                    .parse()
                    .expect("Failed to add directive for logging"),
            ),
        )
        .with(fmt::layer())
        .init();
}
