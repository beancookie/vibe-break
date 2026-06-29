use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

const MAX_LOG_SIZE: u64 = 5 * 1024 * 1024;

fn log_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| {
        let exe = std::env::current_exe().unwrap_or_default();
        exe.parent()
            .map(|p| p.join("logs"))
            .unwrap_or_else(|| PathBuf::from("logs"))
    })
}

fn rotate_if_needed(path: &PathBuf) {
    if let Ok(meta) = fs::metadata(path) {
        if meta.len() > MAX_LOG_SIZE {
            let prev = path.with_extension("prev.log");
            let _ = fs::rename(path, prev);
        }
    }
}

fn ensure_dir(dir: &PathBuf) {
    if !dir.exists() {
        let _ = fs::create_dir_all(dir);
    }
}

#[tauri::command]
pub fn append_log(
    app: tauri::AppHandle,
    level: String,
    message: String,
) -> Result<(), String> {
    let dir = log_dir(&app);
    ensure_dir(&dir);
    let path = dir.join("vibe-break.log");

    rotate_if_needed(&path);

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("open log file failed: {e}"))?;

    let now = chrono::Local::now();
    let ts = now.format("%Y-%m-%d %H:%M:%S%.3f");
    writeln!(file, "[{ts}] [{level}] {message}")
        .map_err(|e| format!("write log failed: {e}"))?;

    log::info!("[WebView] [{level}] {message}");

    Ok(())
}
