use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::crawler::NewsItem;
use tauri::Manager;

const DEDUP_TTL_SECS: u64 = 3 * 24 * 60 * 60;
const CACHE_FILE: &str = "crawler_dedup.json";

pub struct DedupCache {
    seen: HashMap<(String, String), u64>,
    dirty: bool,
}

impl DedupCache {
    pub fn new() -> Self {
        Self { seen: HashMap::new(), dirty: false }
    }

    pub fn load(app: &tauri::AppHandle) -> Self {
        let path = Self::cache_path(app);
        let json = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                log::info!("[crawler] cache not found ({e}), starting fresh");
                return Self::new();
            }
        };

        let flat: HashMap<String, u64> = match serde_json::from_str(&json) {
            Ok(m) => m,
            Err(e) => {
                log::warn!("[crawler] cache parse failed: {e}");
                return Self::new();
            }
        };

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut seen = HashMap::new();
        for (key, ts) in flat {
            if now - ts >= DEDUP_TTL_SECS {
                continue;
            }
            if let Some(sep) = key.find('\0') {
                let source = key[..sep].to_string();
                let title = key[sep + 1..].to_string();
                seen.insert((source, title), ts);
            }
        }

        log::info!("[crawler] cache loaded: {} entries", seen.len());
        Self { seen, dirty: false }
    }

    pub fn save(&self, app: &tauri::AppHandle) {
        if !self.dirty {
            return;
        }
        let path = Self::cache_path(app);
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }

        let mut flat = HashMap::new();
        for ((source, title), ts) in &self.seen {
            flat.insert(format!("{source}\0{title}"), *ts);
        }

        match serde_json::to_string(&flat) {
            Ok(json) => {
                if let Err(e) = std::fs::write(&path, &json) {
                    log::error!("[crawler] cache save failed: {e}");
                } else {
                    log::info!("[crawler] cache saved: {} entries", flat.len());
                }
            }
            Err(e) => log::error!("[crawler] cache serialize failed: {e}"),
        }
    }

    fn cache_path(app: &tauri::AppHandle) -> PathBuf {
        app.path().resource_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(CACHE_FILE)
    }

    pub fn filter(&mut self, items: Vec<NewsItem>) -> Vec<NewsItem> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut result = Vec::new();
        for item in items {
            let key = (item.source.clone(), item.title.clone());
            if let Some(&ts) = self.seen.get(&key) {
                if now - ts < DEDUP_TTL_SECS {
                    continue;
                }
            }
            self.seen.insert(key, now);
            result.push(item);
        }
        self.dirty = true;
        result
    }

    pub fn cleanup(&mut self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        self.seen.retain(|_, &mut ts| now - ts < DEDUP_TTL_SECS);
        self.dirty = true;
    }
}
