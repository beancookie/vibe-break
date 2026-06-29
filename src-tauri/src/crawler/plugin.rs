use std::collections::HashMap;
use std::path::PathBuf;

use async_trait::async_trait;
use mlua::{Function, Lua, Table, Value};

use crate::crawler::{CrawlerPlugin, NewsItem};

pub struct LuaPlugin {
    name: String,
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    script_path: PathBuf,
}

impl LuaPlugin {
    pub fn new(
        name: String,
        url: String,
        method: String,
        headers: HashMap<String, String>,
        body: Option<String>,
        script_path: PathBuf,
    ) -> Self {
        Self { name, url, method, headers, body, script_path }
    }

    fn new_lua() -> Lua {
        let lua = Lua::new();
        Self::inject_helpers(&lua);
        Self::apply_sandbox(&lua);
        lua
    }

    fn inject_helpers(lua: &Lua) {
        let json = lua.create_table().ok();
        if let Some(json) = json {
            let decode = lua
                .create_function(|lua, body: String| {
                    let value: serde_json::Value = match serde_json::from_str(&body) {
                        Ok(v) => v,
                        Err(_) => return Ok(Value::Nil),
                    };
                    Ok(json_to_lua(lua, &value))
                })
                .ok();
            if let Some(decode) = decode {
                json.set("decode", decode).ok();
            }
            lua.globals().set("json", json).ok();
        }

        let html = lua.create_table().ok();
        if let Some(html) = html {
            let select = lua
                .create_function(|lua, (html_str, selector_str): (String, String)| {
                    let doc = scraper::Html::parse_document(&html_str);
                    let sel = match scraper::Selector::parse(&selector_str) {
                        Ok(s) => s,
                        Err(_) => return Ok(lua.create_table().unwrap()),
                    };
                    let results = lua.create_table().unwrap();
                    for (i, element) in doc.select(&sel).enumerate() {
                        let el = lua.create_table().unwrap();
                        let text: String = element.text().collect::<Vec<_>>().join(" ");
                        el.set("text", text).ok();
                        for (name, value) in element.value().attrs() {
                            el.set(name.to_string(), value.to_string()).ok();
                        }
                        results.set(i + 1, el).ok();
                    }
                    Ok(results)
                })
                .ok();
            if let Some(select) = select {
                html.set("select", select).ok();
            }
            lua.globals().set("html", html).ok();
        }
    }

    fn apply_sandbox(lua: &Lua) {
        let g = lua.globals();
        let _ = g.raw_remove("os");
        let _ = g.raw_remove("io");
        let _ = g.raw_remove("loadfile");
        let _ = g.raw_remove("dofile");
        let _ = g.raw_remove("require");
        let _ = g.raw_remove("package");
        let _ = g.raw_remove("debug");
    }

    pub(crate) fn call_parse(path: &PathBuf, response: &str) -> Vec<NewsItem> {
        let lua = Self::new_lua();
        let plugin_table: Table = match lua.load(path.clone()).eval() {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[crawler] Lua eval error: {}", e);
                return Vec::new();
            }
        };

        let parse_func: Function = match plugin_table.get("parse") {
            Ok(f) => f,
            Err(_) => return Vec::new(),
        };

        let result: Value = match parse_func.call(response) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[crawler] Lua parse error: {}", e);
                return Vec::new();
            }
        };

        table_to_news_items(&result)
    }

    pub(crate) fn load_from_path(path: &PathBuf) -> Option<(String, String, String, HashMap<String, String>, Option<String>)> {
        let lua = Self::new_lua();
        let plugin_table: Table = match lua.load(path.clone()).eval() {
            Ok(t) => t,
            Err(_) => return None,
        };

        let name: String = plugin_table.get("name").ok()?;
        let url: String = plugin_table.get("url").ok()?;
        let method: String = plugin_table.get("method").ok()?;

        let headers: HashMap<String, String> = match plugin_table.get("headers") {
            Ok(Value::Table(t)) => {
                let mut map = HashMap::new();
                for pair in t.pairs::<String, String>() {
                    if let Ok((k, v)) = pair {
                        map.insert(k, v);
                    }
                }
                map
            }
            _ => HashMap::new(),
        };

        let body: Option<String> = plugin_table.get("body").ok();

        Some((name, url, method, headers, body))
    }
}

#[async_trait]
impl CrawlerPlugin for LuaPlugin {
    async fn fetch(&self) -> Vec<NewsItem> {
        log::info!("[crawler] {}: requesting {} {}", self.name, self.method, self.url);

        let client = match reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                log::error!("[crawler] {}: reqwest build failed: {e}", self.name);
                return Vec::new();
            }
        };

        let request = match self.method.to_uppercase().as_str() {
            "POST" => {
                let mut req = client.post(&self.url);
                for (k, v) in &self.headers {
                    if let (Ok(name), Ok(val)) = (
                        reqwest::header::HeaderName::from_bytes(k.as_bytes()),
                        reqwest::header::HeaderValue::from_str(v),
                    ) {
                        req = req.header(name, val);
                    }
                }
                if let Some(body) = &self.body {
                    req = req.body(body.clone());
                }
                req
            }
            _ => {
                let mut req = client.get(&self.url);
                for (k, v) in &self.headers {
                    if let (Ok(name), Ok(val)) = (
                        reqwest::header::HeaderName::from_bytes(k.as_bytes()),
                        reqwest::header::HeaderValue::from_str(v),
                    ) {
                        req = req.header(name, val);
                    }
                }
                req
            }
        };

        let response_text = match request.send().await {
            Ok(resp) => {
                let status = resp.status();
                match resp.text().await {
                    Ok(text) => {
                        log::info!("[crawler] {}: HTTP {status}, response length: {}", self.name, text.len());
                        text
                    }
                    Err(e) => {
                        log::error!("[crawler] {}: read response body failed: {e}", self.name);
                        return Vec::new();
                    }
                }
            }
            Err(e) => {
                log::error!("[crawler] {}: HTTP request failed: {e}", self.name);
                return Vec::new();
            }
        };

        let items = Self::call_parse(&self.script_path, &response_text);
        log::info!("[crawler] {}: parsed {} items", self.name, items.len());
        items
    }
}

fn json_to_lua(lua: &Lua, value: &serde_json::Value) -> Value {
    match value {
        serde_json::Value::Null => Value::Nil,
        serde_json::Value::Bool(b) => Value::Boolean(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                Value::Number(f)
            } else {
                Value::Nil
            }
        }
        serde_json::Value::String(s) => match lua.create_string(s.as_bytes()) {
            Ok(s) => Value::String(s),
            Err(_) => Value::Nil,
        },
        serde_json::Value::Array(arr) => {
            let table = lua.create_table().unwrap();
            for (i, v) in arr.iter().enumerate() {
                table.set(i + 1, json_to_lua(lua, v)).ok();
            }
            Value::Table(table)
        }
        serde_json::Value::Object(obj) => {
            let table = lua.create_table().unwrap();
            for (k, v) in obj {
                table.set(k.as_str(), json_to_lua(lua, v)).ok();
            }
            Value::Table(table)
        }
    }
}

fn table_to_news_items(value: &Value) -> Vec<NewsItem> {
    let mut items = Vec::new();
    if let Value::Table(table) = value {
        for pair in table.pairs::<Value, Value>() {
            if let Ok((_, val)) = pair {
                if let Value::Table(item) = val {
                    if let (Ok(title), Ok(link), Ok(source)) = (
                        item.get::<String>("title"),
                        item.get::<String>("link"),
                        item.get::<String>("source"),
                    ) {
                        if !title.is_empty() {
                            items.push(NewsItem { title, link, source });
    }
}

/// 端到端集成测试——发真实 HTTP 请求，调用真实 Lua parse。
/// 用 #[ignore] 隔离，避免 CI/离线时误跑。
/// 运行：cargo test -- --include-ignored e2e
#[cfg(test)]
mod e2e_tests {
    use super::*;
    use crate::crawler::LuaEngine;
    use std::path::Path;

    fn plugin_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("crawlers")
    }

    #[tokio::test]
    #[ignore]
    async fn test_v2ex_real_request() {
        let dir = plugin_dir().join("v2ex.lua");
        let (name, url, method, headers, body) = LuaPlugin::load_from_path(&dir).unwrap();
        let plugin = LuaPlugin::new(name, url, method, headers, body, dir);
        let items = plugin.fetch().await;
        assert!(!items.is_empty(), "V2EX 应当返回至少 1 条热门话题");
        assert_eq!(items[0].source, "V2EX");
        assert!(!items[0].title.is_empty());
        assert!(items[0].link.contains("v2ex.com"));
    }

    #[tokio::test]
    #[ignore]
    async fn test_juejin_real_request() {
        let dir = plugin_dir().join("juejin.lua");
        let (name, url, method, headers, body) = LuaPlugin::load_from_path(&dir).unwrap();
        let plugin = LuaPlugin::new(name, url, method, headers, body, dir);
        let items = plugin.fetch().await;
        assert!(!items.is_empty(), "掘金应当返回至少 1 条沸点");
        assert_eq!(items[0].source, "掘金");
        assert!(!items[0].title.is_empty());
    }

    #[tokio::test]
    #[ignore]
    async fn test_all_sources_real_request() {
        let dir = plugin_dir();
        let plugins = LuaEngine::load_all(&dir);
        let futures: Vec<_> = plugins.iter().map(|p| p.fetch()).collect();
        let results = futures::future::join_all(futures).await;
        let total: usize = results.iter().map(|r| r.len()).sum();
        assert!(total > 0, "所有数据源合并应至少返回 1 条");
        for items in &results {
            for item in items {
                assert!(!item.title.is_empty());
                assert!(!item.link.is_empty());
                assert!(!item.source.is_empty());
            }
        }
    }
}
                }
            }
        }
    }
    items
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn plugin_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("crawlers")
    }

    #[test]
    fn test_juejin_parse_normal() {
        let dir = plugin_dir().join("juejin.lua");
        let mock = r#"<rss><channel><item><title>标题1</title><link>https://juejin.cn/post/1</link></item><item><title><![CDATA[标题2]]></title><link>https://juejin.cn/post/2</link></item></channel></rss>"#;
        let items = LuaPlugin::call_parse(&dir, mock);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].title, "标题1");
        assert_eq!(items[0].link, "https://juejin.cn/post/1");
        assert_eq!(items[0].source, "掘金");
        assert_eq!(items[1].title, "标题2");
    }

    #[test]
    fn test_juejin_parse_empty() {
        let dir = plugin_dir().join("juejin.lua");
        let items = LuaPlugin::call_parse(&dir, r#"{"data":[]}"#);
        assert_eq!(items.len(), 0);
    }

    #[test]
    fn test_juejin_parse_invalid() {
        let dir = plugin_dir().join("juejin.lua");
        let items = LuaPlugin::call_parse(&dir, "not json");
        assert_eq!(items.len(), 0);
    }

    #[test]
    fn test_v2ex_parse_normal() {
        let dir = plugin_dir().join("v2ex.lua");
        let mock = r#"<div class="box" id="TopicsHot"><div class="cell from_1 hot_t_1"><span class="item_hot_topic_title"><a href="/t/1">热门标题1</a></span></div><div class="cell from_2 hot_t_2"><span class="item_hot_topic_title"><a href="/t/2">热门标题2</a></span></div></div>"#;
        let items = LuaPlugin::call_parse(&dir, mock);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].title, "热门标题1");
        assert!(items[0].link.contains("v2ex.com"));
        assert_eq!(items[0].source, "V2EX");
    }

    #[test]
    fn test_v2ex_parse_empty() {
        let dir = plugin_dir().join("v2ex.lua");
        let items = LuaPlugin::call_parse(&dir, "<html></html>");
        assert_eq!(items.len(), 0);
    }
}

/// 用 #[ignore] 隔离，避免 CI/离线时误跑。
/// 运行：cargo test --lib -- --include-ignored e2e_tests
#[cfg(test)]
mod e2e_tests {
    use super::*;
    use crate::crawler::LuaEngine;
    use std::path::Path;

    fn plugin_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("crawlers")
    }

    fn log_items(source: &str, items: &[NewsItem]) {
        println!("\n[crawler E2E] {}: fetched {} items", source, items.len());
        for (i, item) in items.iter().enumerate() {
            println!("  [{}] title={:?}", i, item.title);
            println!("       source={:?} link={:?}", item.source, item.link);
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_v2ex_real_request() {
        let dir = plugin_dir().join("v2ex.lua");
        let (n, u, m, h, b) = LuaPlugin::load_from_path(&dir).unwrap();
        let plugin = LuaPlugin::new(n, u, m, h, b, dir);
        let items = plugin.fetch().await;
        log_items("V2EX", &items);
        assert!(!items.is_empty(), "V2EX should return at least 1 topic");
        assert_eq!(items[0].source, "V2EX");
        assert!(!items[0].title.is_empty());
        assert!(items[0].link.contains("v2ex.com"));
    }

    #[tokio::test]
    #[ignore]
    async fn test_juejin_real_request() {
        let dir = plugin_dir().join("juejin.lua");
        let (n, u, m, h, b) = LuaPlugin::load_from_path(&dir).unwrap();
        let plugin = LuaPlugin::new(n, u, m, h, b, dir);
        let items = plugin.fetch().await;
        log_items("掘金", &items);
        if items.is_empty() {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build().unwrap();
            let text = client.get("https://juejin.cn/rss")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                .send().await.unwrap()
                .text().await.unwrap();
            let preview: String = text.chars().take(500).collect();
            panic!("juejin RSS returned empty, first 500 chars: {:?}", preview);
        }
        assert!(!items.is_empty(), "juejin should return at least 1 item");
        assert_eq!(items[0].source, "掘金");
        assert!(!items[0].title.is_empty());
    }

    #[tokio::test]
    #[ignore]
    async fn test_all_sources_real_request() {
        let dir = plugin_dir();
        let plugins = LuaEngine::load_all(&dir);
        println!("\n[crawler E2E] Loaded {} plugins", plugins.len());
        let futures: Vec<_> = plugins.iter().map(|p| p.fetch()).collect();
        let results = futures::future::join_all(futures).await;
        let total: usize = results.iter().map(|r| r.len()).sum();
        println!("[crawler E2E] All sources combined: {} items", total);
        for (idx, items) in results.iter().enumerate() {
            log_items(&format!("source[{}]", idx), items);
        }
        assert!(total > 0, "all sources combined should return at least 1 item");
        for items in &results {
            for item in items {
                assert!(!item.title.is_empty());
                assert!(!item.link.is_empty());
                assert!(!item.source.is_empty());
            }
        }
    }
}
