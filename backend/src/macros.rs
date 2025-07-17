#[macro_export]
macro_rules! repo {
    ($t:ident) => {
        Arc<dyn $t + Send + Sync>
    };
}
