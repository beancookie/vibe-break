use std::path::Path;

use crate::crawler::plugin::LuaPlugin;
use crate::crawler::CrawlerPlugin;

pub struct LuaEngine;

impl LuaEngine {
    pub fn load_all(plugin_dir: &Path) -> Vec<Box<dyn CrawlerPlugin>> {
        let mut plugins: Vec<Box<dyn CrawlerPlugin>> = Vec::new();
        let Ok(entries) = std::fs::read_dir(plugin_dir) else {
            log::warn!("[crawler] plugin dir not found: {:?}", plugin_dir);
            return plugins;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "lua") {
                match LuaPlugin::load_from_path(&path) {
                    Some((name, url, method, headers, body)) => {
                        log::info!("[crawler] loaded plugin: {name} from {:?}", path);
                        let plugin = LuaPlugin::new(name, url, method, headers, body, path);
                        plugins.push(Box::new(plugin));
                    }
                    None => {
                        log::warn!("[crawler] failed to parse plugin: {:?}", path);
                    }
                }
            }
        }
        log::info!("[crawler] load_all: {} plugins loaded", plugins.len());
        plugins
    }
}
