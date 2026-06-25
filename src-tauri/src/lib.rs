mod mcp_server;

use serde::Serialize;
use tauri::Manager;
use std::fs;
use std::path::{Path, PathBuf};

/// Pet-window aspect ratio (width / height). 0.75 = 3:4 portrait.
/// Matches the `width: 1200, height: 1600` default in tauri.conf.json.
const WINDOW_ASPECT_W_OVER_H: f64 = 0.75;

#[derive(Serialize)]
pub struct AssetEntry {
    /// File name without extension, used as the display name.
    name: String,
    /// Relative path inside `$RESOURCE`, e.g. "assets/Furina.vrm".
    url: String,
}

fn collect(dir: &Path, ext: &str, prefix: &str, out: &mut Vec<AssetEntry>) {
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
        bases.push(p);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            bases.push(dir.join("resources"));
        }
    }

    for base in &bases {
        let assets_dir = base.join("assets");
        if !assets_dir.exists() {
            continue;
        }
        collect(&assets_dir, "vrm", "assets/", &mut out);
        let vrma_dir = assets_dir.join("vrma");
        if vrma_dir.exists() {
            collect(&vrma_dir, "vrma", "assets/vrma/", &mut out);
        }
        if !out.is_empty() {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // Start the MCP HTTP server (background tokio task) so Claude Code
            // can connect and push coding events via the report_event tool.
            mcp_server::start(app.handle().clone());

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
                    let _ = scope.allow_directory(c, true);
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Lock the pet window to a fixed aspect ratio. Tauri has no
            // native aspect-ratio option, so we hook the OS resize event
            // and re-issue a set_size with the width recomputed from
            // the new height. The "pet" resizes itself as well via
            // JS (appState.petScale), so this constraint only kicks in
            // for user-driven window drags.
            if let tauri::WindowEvent::Resized(size) = event {
                let h = size.height.max(1) as f64;
                let w = size.width as f64;
                let target_w = (h * WINDOW_ASPECT_W_OVER_H).round() as u32;
                // Only push a corrected size when the OS has actually
                // produced an off-ratio size. set_size itself fires
                // another Resized event; the comparison against the
                // current width keeps us from looping.
                if (w - target_w as f64).abs() >= 1.0 {
                    let _ = window.set_size(tauri::PhysicalSize::new(
                        target_w,
                        size.height,
                    ));
                }
            }
        })
        .invoke_handler(tauri::generate_handler![list_assets])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
