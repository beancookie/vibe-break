mod cache;
mod engine;
mod plugin;

pub use cache::DedupCache;
pub use engine::LuaEngine;

use async_trait::async_trait;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

#[derive(Serialize, Clone)]
pub struct NewsItem {
    pub title: String,
    pub link: String,
    pub source: String,
}

#[async_trait]
pub trait CrawlerPlugin: Send + Sync {
    fn name(&self) -> &str;
    async fn fetch(&self) -> Vec<NewsItem>;
}

fn find_crawler_dirs(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();

    if let Ok(p) = app.path().resource_dir() {
        dirs.push(p.join("crawlers"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            dirs.push(dir.join("resources").join("crawlers"));
        }
    }
    dirs
}

#[tauri::command]
pub fn fetch_news(
    app: tauri::AppHandle,
    cache: tauri::State<'_, Mutex<DedupCache>>,
) -> Vec<NewsItem> {
    let candidates = find_crawler_dirs(&app);
    let mut plugins: Vec<Box<dyn CrawlerPlugin>> = Vec::new();

    for dir in &candidates {
        if dir.exists() {
            log::info!("[crawler] loading from: {:?}", dir);
            plugins = LuaEngine::load_all(dir);
            if !plugins.is_empty() {
                break;
            }
        } else {
            log::warn!("[crawler] candidate dir not found: {:?}", dir);
        }
    }

    if plugins.is_empty() {
        log::warn!("[crawler] No plugins found in any candidate dir");
        for dir in &candidates {
            log::warn!("[crawler]   tried: {:?}", dir);
        }
        return Vec::new();
    }

    log::info!("[crawler] loaded {} plugins", plugins.len());

    let rt = tokio::runtime::Runtime::new().unwrap();
    let results = rt.block_on(async {
        let futures: Vec<_> = plugins.iter().map(|p| p.fetch()).collect();
        futures::future::join_all(futures).await
    });

    let all_items: Vec<NewsItem> = results.into_iter().flatten().collect();
    log::info!("[crawler] raw items from plugins: {}", all_items.len());

    let mut dedup = match cache.lock() {
        Ok(c) => c,
        Err(e) => {
            log::error!("[crawler] cache lock failed: {e}");
            return all_items;
        }
    };

    let filtered = dedup.filter(all_items);
    log::info!("[crawler] after dedup filter: {} items", filtered.len());

    dedup.save(&app);
    drop(dedup);

    filtered
}
