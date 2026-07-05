pub mod database;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeMode {
    Desktop,
    HeadlessApi,
    WindowsService,
    LinuxService,
    Cli,
    Worker,
}

#[derive(Debug, Clone)]
pub struct AppFeatureFlags {
    pub licensing: bool,
    pub internal_api: bool,
    pub scalar_docs: bool,
    pub tray: bool,
    pub windows_service: bool,
    pub linux_service: bool,
    pub auto_start_with_windows: bool,
    pub headless_mode: bool,
}

impl Default for AppFeatureFlags {
    fn default() -> Self {
        Self {
            licensing: true,
            internal_api: false,
            scalar_docs: false,
            tray: true,
            windows_service: false,
            linux_service: false,
            auto_start_with_windows: false,
            headless_mode: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct DefaultAdminConfig {
    pub enabled: bool,
    pub username: String,
    pub password: String,
    pub force_password_change_on_first_login: bool,
}

impl Default for DefaultAdminConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            username: String::new(),
            password: String::new(),
            force_password_change_on_first_login: true,
        }
    }
}
