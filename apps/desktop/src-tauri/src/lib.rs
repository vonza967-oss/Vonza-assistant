use tauri::{AppHandle, Emitter, WebviewUrl, WebviewWindowBuilder};
use url::Url;

const DEFAULT_DASHBOARD_URL: &str = "https://vonza-assistant.onrender.com/dashboard";
const WINDOW_LABEL: &str = "main";

fn dashboard_url() -> Url {
    std::env::var("VONZA_DESKTOP_DASHBOARD_URL")
        .ok()
        .and_then(|value| Url::parse(value.trim()).ok())
        .filter(|url| matches!(url.scheme(), "https" | "http"))
        .unwrap_or_else(|| Url::parse(DEFAULT_DASHBOARD_URL).expect("default dashboard URL must be valid"))
}

fn is_same_origin(left: &Url, right: &Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str() == right.host_str()
        && left.port_or_known_default() == right.port_or_known_default()
}

fn should_open_in_system_browser(target: &Url, dashboard: &Url) -> bool {
    if is_same_origin(target, dashboard) {
        return false;
    }

    match target.host_str().unwrap_or_default() {
        "accounts.google.com" | "oauth2.googleapis.com" => true,
        host if host.ends_with(".google.com") => true,
        host if host.ends_with(".googleapis.com") => true,
        _ => !matches!(target.scheme(), "http" | "https"),
    }
}

fn open_system_browser(app: &AppHandle, url: &Url) {
    if let Err(error) = tauri_plugin_opener::open_url(url.as_str(), None::<&str>) {
        eprintln!("[vonza-desktop] failed to open external URL: {error}");
        let _ = app.emit("vonza://external-open-failed", url.as_str());
    }
}

fn create_main_window(app: &AppHandle) -> tauri::Result<()> {
    let dashboard = dashboard_url();
    let navigation_dashboard = dashboard.clone();
    let app_handle = app.clone();

    WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::External(dashboard))
        .title("Vonza")
        .inner_size(1440.0, 960.0)
        .min_inner_size(1100.0, 760.0)
        .resizable(true)
        .center()
        .on_navigation(move |target| {
            if should_open_in_system_browser(&target, &navigation_dashboard) {
                open_system_browser(&app_handle, &target);
                return false;
            }

            true
        })
        .build()?;

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            create_main_window(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Vonza desktop app");
}
