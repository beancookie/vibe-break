use std::sync::Mutex;

mod crawler;
mod logger;
mod mcp_server;

use serde::Serialize;
use tauri::Manager;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone)]
pub struct AssetEntry {
    /// File name without extension, used as the display name.
    pub name: String,
    /// Relative path inside `$RESOURCE`, e.g. "assets/Furina.vrm".
    pub url: String,
}

pub fn collect_dir(dir: &Path, ext: &str, prefix: &str, out: &mut Vec<AssetEntry>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    let mut found: Vec<AssetEntry> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file())
        .filter(|p| {
            p.extension()
                .and_then(|x| x.to_str())
                .map(|x| x.eq_ignore_ascii_case(ext))
                .unwrap_or(false)
        })
        .map(|p| {
            let file_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            let name = p.file_stem().and_then(|n| n.to_str()).unwrap_or(file_name);
            AssetEntry {
                name: name.to_string(),
                url: format!("{prefix}{file_name}"),
            }
        })
        .collect();
    found.sort_by(|a, b| a.url.cmp(&b.url));
    out.extend(found);
}

/// Scan the bundled `$RESOURCE/assets/` directory and return every
/// `.vrm` (top-level) and `.vrma` (in `vrma/`) file, sorted by name.
#[tauri::command]
fn list_assets(app: tauri::AppHandle) -> Result<Vec<AssetEntry>, String> {
    let mut out: Vec<AssetEntry> = Vec::new();
    let mut bases: Vec<PathBuf> = Vec::new();

    if let Ok(p) = app.path().resource_dir() {
        log::info!("[list_assets] resource_dir={}", p.display());
        bases.push(p);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let dev = dir.join("resources");
            log::info!("[list_assets] exe_parent/resources={}", dev.display());
            bases.push(dev);
        }
    }

    for base in &bases {
        let assets_dir = base.join("assets");
        log::info!("[list_assets] trying {}", assets_dir.display());
        if !assets_dir.exists() {
            log::info!("[list_assets]   not found");
            continue;
        }
        collect_dir(&assets_dir, "vrm", "assets/", &mut out);
        let vrma_dir = assets_dir.join("vrma");
        if vrma_dir.exists() {
            collect_dir(&vrma_dir, "vrma", "assets/vrma/", &mut out);
        }
        if !out.is_empty() {
            let names: Vec<&str> = out.iter().map(|a| a.name.as_str()).collect();
            log::info!("[list_assets] found {} assets: {:?}", out.len(), names);
            return Ok(out);
        }
        out.clear();
    }

    let tried = bases
        .iter()
        .map(|b| b.join("assets").display().to_string())
        .collect::<Vec<_>>()
        .join(" | ");
    Err(format!("No .vrm/.vrma files found. Tried: {tried}"))
}

#[tauri::command]
fn block_news(
    app: tauri::AppHandle,
    cache: tauri::State<'_, Mutex<crawler::DedupCache>>,
    source: String,
    title: String,
) -> Result<(), String> {
    let mut dedup = cache.lock().map_err(|e| format!("cache lock failed: {e}"))?;
    dedup.mark_seen(&source, &title);
    dedup.save(&app);
    log::info!("[crawler] block_news: source={source} title={title}");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info")
    ).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Start the MCP HTTP server (background tokio task) so Claude Code
            // can connect and push coding events via the report_event tool.
            mcp_server::start(app.handle().clone());

            app.manage(Mutex::new(crawler::DedupCache::load(app.handle())));

            // The asset:// protocol scope is configured in
            // tauri.conf.json. In Tauri 2 the static scope patterns may
            // not match all resolved paths (depending on the build
            // layout and platform glob semantics), so we also
            // register the on-disk resource directory at runtime.
            let candidates: Vec<PathBuf> = {
                let mut v: Vec<PathBuf> = Vec::new();
                if let Ok(p) = app.path().resource_dir() {
                    v.push(p);
                }
                if let Ok(exe) = std::env::current_exe() {
                    if let Some(dir) = exe.parent() {
                        let dev = dir.join("resources");
                        if !v.contains(&dev) {
                            v.push(dev);
                        }
                    }
                }
                v
            };

            let scope = app.asset_protocol_scope();
            for c in &candidates {
                if c.exists() {
                    log::info!("[setup] allow_directory scope={}", c.display());
                    let _ = scope.allow_directory(c, true);
                } else {
                    log::warn!("[setup] candidate does not exist: {}", c.display());
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_assets,
            crawler::fetch_news,
            block_news,
            logger::append_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
