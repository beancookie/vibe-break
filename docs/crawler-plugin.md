# 爬虫插件框架

## 设计目标

- 动态注册：新增数据源只需写一个 `.lua` 脚本文件，放入插件目录即可，**零 Rust 编译**
- 容错：单个插件失败不影响其他插件
- 并行：所有插件并发执行，合并结果
- 安全：Lua 沙箱限制，脚本只能做数据解析，不能访问文件/网络/系统

## 架构概览

```
src-tauri/
├── src/crawler/          # Rust 源码
│   ├── mod.rs            CrawlerPlugin trait + fetch_news command
│   ├── engine.rs         Lua 引擎（mlua 加载脚本、注入工具函数）
│   └── plugin.rs         LuaPlugin 结构体（HTTP 请求 + Lua parse）
│
└── resources/crawlers/    ← Lua 脚本目录（运行时扫描）
    ├── juejin.lua
    └── v2ex.lua

reqwest (HTTP)  ──→ 发请求 → 响应文本
                    ↓
mlua (Lua VM)   ──→ 传响应给脚本 parse()
                    ↓
                返回 Vec<NewsItem>
```

## 目录结构

```
src-tauri/src/crawler/
├── mod.rs           # CrawlerPlugin trait、fetch_news command
├── engine.rs        # LuaEngine：扫描 resources/crawlers/ 加载 .lua 脚本
├── plugin.rs        # LuaPlugin 结构体（实现 CrawlerPlugin）
└── source/          # （可选）README 等非 Rust 资源

src-tauri/resources/crawlers/   ← Lua 脚本目录
├── juejin.lua
└── v2ex.lua
```

## 数据模型

```rust
#[derive(Serialize, Clone)]
pub struct NewsItem {
    pub title: String,
    pub link: String,
    pub source: String,
}
```

## 核心接口

### CrawlerPlugin trait

```rust
#[async_trait]
pub trait CrawlerPlugin: Send + Sync {
    fn name(&self) -> &str;
    async fn fetch(&self) -> Vec<NewsItem>;
}
```

### LuaPlugin

```rust
pub struct LuaPlugin {
    name: String,
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    script_path: PathBuf,
}

#[async_trait]
impl CrawlerPlugin for LuaPlugin {
    async fn fetch(&self) -> Vec<NewsItem> {
        // Rust 侧用 reqwest 发 HTTP 请求
        let response = self.do_request().await;
        // 加载 .lua 脚本，调用 parse() 函数
        Self::call_parse(&self.script_path, &response)
    }
}
```

## Tauri Command

```rust
// crawler/mod.rs

#[tauri::command]
pub fn fetch_news(app: tauri::AppHandle) -> Vec<NewsItem> {
    let mut plugin_dir = app.path().resource_dir().unwrap_or_default();
    plugin_dir.push("crawlers");
    let plugins = LuaEngine::load_all(&plugin_dir);
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let futures: Vec<_> = plugins.iter().map(|p| p.fetch()).collect();
        let results = futures::future::join_all(futures).await;
        results.into_iter().flatten().collect()
    })
}
```

`fetch_news` 命令注入 `tauri::AppHandle` 参数，通过 `app.path().resource_dir()` 定位 `resources/crawlers/` 目录，加载所有 `.lua` 脚本，并发执行每个插件的 HTTP 请求 + Lua parse，合并结果返回前端。

## Lua 引擎

### 初始化与依赖注入

```rust
pub struct LuaEngine;

impl LuaEngine {
    /// 将 Rust 工具函数注入到 Lua 全局环境
    fn inject_helpers(lua: &Lua) {
        // json 工具：json.decode(str) → table
        let json = lua.create_table().unwrap();
        json.set("decode", lua.create_function(|lua, body: String| {
            let value: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
            Ok(json_to_lua(lua, &value))
        })).ok();
        lua.globals().set("json", json).ok();

        // html 工具：html.select(html_str, css_selector) → table
        let html = lua.create_table().unwrap();
        html.set("select", lua.create_function(|lua, (html_str, selector): (String, String)| {
            let doc = scraper::Html::parse_document(&html_str);
            let sel = scraper::Selector::parse(&selector).unwrap();
            let results = lua.create_table().unwrap();
            for (i, element) in doc.select(&sel).enumerate() {
                let el = lua.create_table().unwrap();
                el.set("text", element.text().collect::<Vec<_>>().join(" ")).ok();
                for (name, value) in element.value().attrs() {
                    el.set(name.to_string(), value.to_string()).ok();
                }
                results.set(i + 1, el).ok();
            }
            Ok(results)
        })).ok();
        lua.globals().set("html", html).ok();
    }

    /// Lua 沙箱安全限制
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

    /// 加载 resources/crawlers/ 目录下的所有 .lua 文件
    pub fn load_all(plugin_dir: &Path) -> Vec<Box<dyn CrawlerPlugin>> {
        let mut plugins = Vec::new();
        let Ok(entries) = std::fs::read_dir(plugin_dir) else { return plugins };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "lua") {
                if let Some(plugin) = LuaPlugin::load_from_file(&path) {
                    plugins.push(Box::new(plugin));
                }
            }
        }
        plugins
    }
}
```

## Lua 脚本

### 脚本格式

每个 `.lua` 文件 `return` 一个表（table），包含 `name`、`url`、`method`、`headers`、`body`、`parse` 字段。

### 掘金沸点 (`resources/crawlers/juejin.lua`)

```lua
local plugin = {}

plugin.name = "juejin"
plugin.url = "https://api.juejin.cn/recommend_api/v1/short_msg/hot"
plugin.method = "POST"
plugin.headers = {
  ["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  ["Content-Type"] = "application/json"
}
plugin.body = '{"cursor":"0"}'

function plugin.parse(response)
  local items = {}
  local ok, data = pcall(json.decode, response)
  if not ok then return items end
  if data and data.data then
    for _, item in ipairs(data.data) do
      table.insert(items, {
        title = item.content,
        link = item.url or "",
        source = "掘金"
      })
    end
  end
  return items
end

return plugin
```

### V2EX 热门 (`resources/crawlers/v2ex.lua`)

```lua
local plugin = {}

plugin.name = "v2ex"
plugin.url = "https://www.v2ex.com/?tab=hot"
plugin.method = "GET"
plugin.headers = {
  ["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

function plugin.parse(html)
  local items = {}
  local ok, links = pcall(html.select, html, ".topic-link")
  if not ok then return items end
  for _, link in ipairs(links) do
    local title = link.text
    local href = link.href
    if title and title ~= "" then
      table.insert(items, {
        title = title,
        link = "https://www.v2ex.com" .. (href or ""),
        source = "V2EX"
      })
    end
  end
  return items
end

return plugin
```

## 调用流程

```
fetch_news command (前端 invoke)
  │
  ├── app.path().resource_dir() + "crawlers/"
  │     └── LuaEngine::load_all()
  │           ├── juejin.lua → LuaPlugin
  │           └── v2ex.lua   → LuaPlugin
  │
  ├── join_all(并发执行)
  │     ├── LuaPlugin::fetch() [juejin]
  │     │    ├── reqwest POST → JSON 响应
  │     │    └── Lua parse() → Vec<NewsItem>
  │     │
  │     ├── LuaPlugin::fetch() [v2ex]
  │     │    ├── reqwest GET → HTML 响应
  │     │    └── Lua parse() → Vec<NewsItem>
  │
  └── 合并结果 → 返回前端
```

## Rust 注入 Lua 的工具

| Lua 全局函数 | Rust 底层实现 | 用途 |
|---|---|---|
| `json.decode(str)` → table | `serde_json::from_str` + `lua.create_table` | 解析 JSON 响应 |
| `html.select(html_str, css)` → table | `scraper::Html::parse_document` + CSS 选择器 | 解析 HTML |

Element 对象属性：
- `element.text` → string：文本内容
- `element.href` → string：`href` 属性值（及其他 HTML 属性）

## 注册与集成

### 注册 command

```rust
// lib.rs
mod crawler;

.invoke_handler(tauri::generate_handler![
    list_assets,
    crawler::fetch_news,      // ← 新增
])
```

### 打包配置

```json
// tauri.conf.json
{
  "bundle": {
    "resources": [
      "resources/assets/*.vrm",
      "resources/assets/vrma/*.vrma",
      "resources/crawlers/*.lua"   // ← 新增
    ]
  }
}
```

## 新增依赖

```toml
[dependencies]
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
mlua = { version = "0.10", features = ["lua54", "vendored", "serialize"] }
scraper = "0.27"
futures = "0.3"
```

### 依赖说明

| 依赖 | 用途 | 理由 |
|---|---|---|
| `reqwest` | HTTP 客户端 | Rust 最主流的异步 HTTP 库，支持 JSON 和 TLS |
| `mlua` | Lua 运行时 | 最活跃的 Rust-Lua 绑定，vendored 捆绑 Lua 5.4 |
| `scraper` | HTML 解析 | Rust 生态最成熟的 HTML CSS 选择器库 |
| `futures` | 并行工具 | `join_all` 并发执行多个插件 |

## 前端集成

在 `src/main.ts` 中 `scanAssets()` 完成后添加：

```typescript
import type { NewsItem } from "$lib/stores.svelte";
import { pushNews } from "$lib/stores.svelte";

invoke<NewsItem[]>("fetch_news").then(items => {
    items.forEach(pushNews);
});
```

前端已有的 `pushNews()` 和 `Barrage` 组件无需改动。

## 如何新增一个爬虫插件

```
1. 在 src-tauri/resources/crawlers/ 下创建 .lua 文件
2. 填写以下配置：
   - plugin.name:       数据源名称（如 "zhihu"）
   - plugin.url:        请求地址
   - plugin.method:     GET / POST
   - plugin.headers:    请求头（User-Agent 等）
   - plugin.body:       POST body（可选）
   - plugin.parse(response): 解析函数，返回 NewsItem 列表
3. 重启应用，自动加载
```

**零 Rust 代码改动，零编译。**

## Lua 安全限制

| 禁止 | 原因 |
|---|---|
| `os.execute` / `os.*` | 防止执行系统命令 |
| `io.*` | 防止读写文件 |
| `loadfile` / `dofile` | 防止动态加载额外代码 |
| `require` / `package` | 防止加载 C 模块 |
| `debug.*` | 防止逃逸沙箱 |

## 错误处理策略

- **HTTP 请求失败**：reqwest 超时/错误 → 插件返回空 Vec
- **Lua parse 失败**：Lua 运行时错误 → 捕获异常 → 返回空 Vec
- **插件目录不存在**：整体返回空 Vec
- **脚本格式错误**：跳过该脚本，不影响其他脚本
- 单个插件失败完全不影响其他插件
