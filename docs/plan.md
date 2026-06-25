# Vibe Break — 最终集成与插件化设计文档

版本：1.0  
作者：beancookie / 整理：Copilot

说明（直接结论）

- 目标：把 Claude Code（或其它 MCP 客户端）的事件流接入 Vibe Break，把 AI 的内部状态（thinking / file.write / command.exec / done / error / progress）实时可视化，并在“thinking”时展示摸鱼新闻（V2EX / 掘金），在达到阈值时发送鼓励、在出错时给出反馈、并在特定时间发送吃饭/下班提醒。
- 要求：系统必须可扩展（插件化）、安全（权限控制）、性能友好（主线程轻量化、后端做网络/解析）、并提供良好的可测试/打包流程。
- 方案概览：将应用拆为 Core + Plugin 层。Core（Tauri/Rust + Svelte）负责渲染、状态、EventBus、PluginManager、AnimationController；插件分为 Frontend 插件（热加载 TS/JS + Svelte UI）、Backend 插件（独立进程，通过 JSONL/stdio 或 socket 与 Core 通信）与混合插件。Core 提供托管 API（事件、状态、invoke、UI slot、通知、持久化），插件通过 manifest 声明权限并在用户授权后运行。

我已把之前所有讨论的设计、协议、示例与实现要点整合到下面这份完整文档里，便于直接落地与后续扩展。你可以直接把它放入仓库 `docs/final_plan.md`，或让我把代码改动与示例补丁开 PR。

---

目录

1. 目标与需求摘要
2. 高层架构
3. 事件协议（MCP -> Vibe Break）
4. Core 组件详解
5. 插件系统设计（manifest、API、运行模型）
6. 插件示例
   - 6.1 后端新闻插件（news）
   - 6.2 前端鼓励插件（encourage）
7. 前端接入（appState / mcpBridge / AnimationController / UI）
8. 权限、隐私与安全考虑
9. 持久化与配置
10. 测试与调试策略
11. 打包与部署注意事项（Tauri）
12. 迭代与实施计划（M1..M4）
13. 附录：关键代码片段（示例实现）

---

1. 目标与需求摘要

- 实时接收并可视化 MCP 事件（thinking、file.write、command.exec、done、error、progress）。
- 在 thinking 时展示来自 V2EX / 掘金 的短新闻轮播（后端抓取、去重、缓存）。
- 鼓励策略：达到配置阈值（例如写文件 25 次）触发鼓励消息，带冷却（例如 45 分钟）。
- 错误反馈：error 事件记录、UI 弹出、可一键复制或打开 Issue 模板。
- 定时提醒：午餐提醒、下班汇总（后端定时器 + 系统通知）。
- 一切功能应以插件形式可扩展/关闭/替换。

2. 高层架构

- Core（Tauri/Rust + Svelte）
  - EventBus（跨前后端/插件的事件总线）
  - AppState（全局响应式状态）
  - PluginManager（发现 / 加载 / 权限 / 卸载）
  - AnimationController（事件 -> 动画/表情/特效）
  - UI Shell（VrmViewer、ContextMenu、Plugin 管理入口）
- Plugins
  - Frontend plugin（动态 import 的 JS/TS，能注册 UI slot、读取/写入 state、订阅事件）
  - Backend plugin（独立进程，JSONL/stdio 或 socket 协议，做网络抓取、文件 IO、持久化、重度计算）
  - Hybrid plugin（frontend + backend 协同）
- IPC/通信
  - Core 与前端插件：直接函数调用 / Host API
  - Core 与后端插件：spawn 进程 + JSONL over stdio 或 socket
  - Core 向 Svelte 前端：window.emit / tauri event listen

3. 事件协议（MCP -> Vibe Break）

- MCP 事件 JSON schema（最低字段）：
  {
  "type": "thinking" | "thinking:end" | "file.write" | "command.exec" | "done" | "error" | "progress",
  "meta": { ... },
  "ts": 168xxxxxx
  }
- 常用 meta 示例：
  - file.write: { path: "src/foo.ts" }
  - command.exec: { cmd: "pnpm build", status: "start" | "end" }
  - error: { message: "...", stack?: "..." }
  - progress: { percent: 0..100 }

4. Core 组件详解

- EventBus
  - publish(eventName, payload)
  - subscribe(eventName, handler): returns unsubscribe
  - 用途：插件、AnimationController、UI 等统一订阅 MCP 事件及插件事件。
- AppState（响应式）
  - aiState: "idle"|"thinking"|...
  - counters: { filesWritten, commandsRun, errors }
  - thinkingPeriods: [{start, end}]
  - news: NewsItem[]
  - ui: { showNews, showEncouragement, errorMsg, ... }
  - config: plugin 与全局配置
- PluginManager
  - 发现（本地 plugins/ 或打包内 assets/plugins/）
  - 加载（dynamic import frontend; spawn backend）
  - 权限校验（manifest -> 用户确认）
  - 插件生命周期：init(host) -> running -> onUnload()
- AnimationController
  - 提供 API 给前端插件与 core：playAnimation(url), playEffect(name, options), setExpression(name, value)
  - 管理 crossfade、one-shot effects、priority
- UI Shell
  - 插槽（slot）设计：top-right, bottom-left, overlay, context-menu-extension
  - 插件可向 slot 注册 UI 渲染函数（Core 在对应位置挂载 DOM）

5. 插件系统设计（manifest、API、运行模型）

- Manifest (plugin.json) 必须声明：
  - id, name, version, description
  - permissions: ["network", "persist", "spawn-backend", "open-shell"]
  - frontend: { entry: "./frontend/index.js", uiSlots: ["overlay-bottom-left"] }
  - backend: { entry: "./backend/news_fetcher.py", protocol: "jsonl" }
  - compat.coreVersion: ">=0.4.0"
- PluginHost API（前端插件可用）
  - eventBus: subscribe(), emit()
  - state: get(), patch(), watch(selector, handler)
  - invoke(cmd, args) -> Promise (Core 将它映射到 Tauri commands 或转发给后端 plugin)
  - registerUI(slotId, mountEl => void) -> unregister
  - notify(level, title, body)
  - log(level, msg)
  - permissions.has(name)
- 后端插件协议（JSONL）
  - 每行 JSON：{ type: "event"|"command"|"log", name: "...", payload: {...} }
  - Core 发起的 command 同样 JSONL 发给后端插件，后端通过 stdout 推送事件到 Core

6. 插件示例
   6.1 News 插件（后端 + 前端）

- Backend: 周期性抓取 V2EX / 掘金 / 其它 feed，parse -> 去重 -> 缓存 -> 输出事件 news.items
- Frontend: 订阅 news.items，state.patch({news, showNews:true})，registerUI 到 overlay-bottom-left 渲染 NewsTicker
- 权限：network, persist
- 缓存 TTL 建议：600s（10 分钟）

  6.2 Encourage 插件（前端）

- 纯前端插件，订阅 file.write 事件、维护计数、触发鼓励 toast（阈值、冷却）并能调用 Core.notify() 做系统通知（需 permission）
- 权限：notify（或者 open-shell）

7. 前端接入（关键点）

- mcpBridge.ts
  - listen("mcp:event") -> 更新 appState、计数、触发 fetchNews（thinking）
  - 负责把简单的事件翻译成 appState 操作（e.g., thinking 开始/结束）
- stores.svelte（appState）
  - 加入 counters、thinkingPeriods、news、ui、config
- AnimationController / VrmModel
  - 订阅 appState.aiState 与 appState.specialEffect
  - 利用 existing mixer / clipCache 逻辑切换 animation（使用 currentRev / animToken 同步）
  - 为 short-lived effects（celebrate、shake）提供 one-shot 播放入口
- NewsTicker.svelte（UI）
  - 轮播标题、点击打开（tauri shell.open）、可关闭 & 缓存展示状态

8. 权限、隐私与安全

- 插件 manifest 声明权限；首次启用弹窗请求用户授权
- 默认关闭网络抓取类插件；需要用户主动开启
- 抓取来的内容仅返回纯文本标题与链接，避免注入 HTML
- 若要匿名化流量，支持“使用代理”设置
- 后端插件运行在独立进程，作为沙箱隔离风险

9. 持久化与配置

- Core 提供 persist API（文件或 sqlite）供插件与 Core 保存 counters、plugin config、history
- 每 plugin 有 namespace: plugins.<id>.\* 存储配置
- 日终摘要、事件历史与统计可保存为 JSONL 或数据库（便于分析）

10. 测试与调试策略

- 单元测试
  - Rust：news fetcher、cache、mcp listener parser
  - TS：plugin manager、eventBus、encourage 算法
- 集成测试
  - 模拟 mcp_feeder.py 发送 JSONL 到 Core（stdin 模式）
  - 启动 tauri dev，断言 appState 变化、news 界面展示、动画触发
- E2E（可选）
  - 用 headless + 截图断言视觉效果（需要 ui 可编程化触发）
- 开发体验
  - 支持 dev 模式动态加载本地 plugin（absolute path），Log 可在 Core console/日志文件查看

11. 打包与部署注意事项（Tauri）

- 前端插件作为静态资源打包进入 assets/plugins/（并在运行时由 PluginManager 读取）
- 后端插件若为可执行文件，需在 tauri 打包资源中包含（tauri.conf.json 里的 bundler configs）
- 在 Windows/macOS/Linux 打包时确认 backend 可执行的相对路径或安装目录（在 manifest 中可使用 placeholders）
- 在打包前运行 plugin 打包脚本，把插件二进制或脚本放置到 src-tauri/resources/ 或 assets/

12. 迭代与实施计划

- M1（1-2 天） 最小可用：
  - 实现 MCP stdin listener -> window.emit（Rust）
  - 前端 mcpBridge -> appState.aiState 切换（thinking/file.write/done）
  - 基本 AnimationController 调用 points（demo）
- M2（1-2 天） News 插件（backend + frontend）：
  - 后端实现 fetch_news (reqwest + feed-rs)，cache；Core spawn 后端插件或作为内置命令
  - 前端 NewsTicker 渲染
- M3（1-2 天） Encourage plugin + counters + persist：
  - 在 mcpBridge 增加 counters，Encourage 插件监听并触发 toast、系统通知
- M4（3-7 天） 完整插件化与权限：
  - 完成 PluginManager、manifest 支持、权限请求 UI、插件管理界面
  - 增强测试与打包支持
- 每个里程碑：提交 PR、文档、以及示例插件

13. 附录：关键代码片段（示例实现）
    下面给出关键示例（供参考与快速上手）。这些都是参考实现，实际集成时请根据仓库风格与类型调整。

- Rust: 简单 stdin MCP listener（src-tauri/src/mcp_listener.rs）

```rust name=src-tauri/src/mcp_listener.rs
use tauri::Manager;
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, BufReader};

pub fn spawn_stdio_mcp_listener(window: tauri::Window) {
  tauri::async_runtime::spawn(async move {
    let stdin = tokio::io::stdin();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();
    loop {
      line.clear();
      match reader.read_line(&mut line).await {
        Ok(0) => break,
        Ok(_) => {
          if let Ok(json) = serde_json::from_str::<Value>(line.trim()) {
            let _ = window.emit("mcp:event", json);
          } else {
            eprintln!("mcp parse failed: {}", line);
          }
        }
        Err(e) => {
          eprintln!("mcp read error: {:?}", e);
          break;
        }
      }
    }
  });
}
```

- Rust: fetch_news command（src-tauri/src/news.rs）

```rust name=src-tauri/src/news.rs
use serde::Serialize;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use feed_rs::parser;
use reqwest::Client;
use lazy_static::lazy_static;
use std::collections::HashMap;

#[derive(Serialize, Clone)]
pub struct NewsItem {
  pub title: String,
  pub link: Option<String>,
  pub source: String,
  pub published: Option<String>,
}

lazy_static! {
  static ref CACHE: Mutex<HashMap<&'static str, (Instant, Vec<NewsItem>)>> =
    Mutex::new(HashMap::new());
}

const CACHE_TTL: Duration = Duration::from_secs(60 * 10);

async fn fetch_feed(client: &Client, url: &str, source_name: &str) -> Vec<NewsItem> {
  let mut out = Vec::new();
  if let Ok(resp) = client.get(url).send().await {
    if let Ok(bytes) = resp.bytes().await {
      if let Ok(feed) = parser::parse(&bytes[..]) {
        for entry in feed.entries.into_iter().take(12) {
          let title = entry.title.map(|t| t.content).unwrap_or_default();
          let link = entry.links.first().map(|l| l.href.clone()).or(entry.id.clone());
          let published = entry.published.map(|d| d.to_rfc3339());
          out.push(NewsItem { title, link, source: source_name.to_string(), published });
        }
      }
    }
  }
  out
}

#[tauri::command]
pub async fn fetch_news() -> Result<Vec<NewsItem>, String> {
  let mut cache = CACHE.lock().await;
  let key = "default_feeds";
  if let Some((t, items)) = cache.get(key) {
    if t.elapsed() < CACHE_TTL {
      return Ok(items.clone());
    }
  }

  let client = Client::builder()
    .user_agent("vibe-break/1.0")
    .build()
    .map_err(|e| format!("client build err: {}", e))?;

  let feeds = vec![
    ("https://www.v2ex.com/feed.atom", "V2EX"),
    ("https://juejin.cn/feed", "Juejin"),
  ];

  let mut all: Vec<NewsItem> = Vec::new();
  for (url, source) in feeds {
    let mut got = fetch_feed(&client, url, source).await;
    all.append(&mut got);
  }

  let mut seen = std::collections::HashSet::new();
  let mut deduped = Vec::new();
  for it in all.into_iter() {
    let key_title = format!("{}::{}", it.source, it.title);
    if seen.insert(key_title) { deduped.push(it); }
    if deduped.len() >= 30 { break; }
  }

  cache.insert(key, (Instant::now(), deduped.clone()));
  Ok(deduped)
}
```

- Frontend: mcpBridge.ts（src/lib/mcpBridge.ts）

```ts name=src/lib/mcpBridge.ts
import { listen } from "@tauri-apps/api/event";
import { appState } from "$lib/stores.svelte";
import { fetchNews } from "$lib/news";

export async function startMcpBridge() {
  const unlisten = await listen("mcp:event", (evt) => {
    const payload = evt.payload as any;
    if (!payload || !payload.type) return;
    switch (payload.type) {
      case "thinking":
        appState.aiState = "thinking";
        appState.status = "AI thinking…";
        if (!appState.thinkingStart) {
          appState.thinkingStart = Date.now();
          appState.thinkingPeriods.push({ start: appState.thinkingStart });
        }
        // fetch news in background
        void (async () => {
          const news = await fetchNews();
          if (news.length > 0) {
            appState.news = news;
            appState.showNews = true;
          }
        })();
        break;
      case "thinking:end":
        appState.aiState = "idle";
        if (appState.thinkingStart) {
          const t = appState.thinkingStart;
          appState.thinkingStart = 0;
          const last = appState.thinkingPeriods[appState.thinkingPeriods.length - 1];
          if (last && !last.end) last.end = Date.now();
        }
        break;
      case "file.write":
        appState.counters.filesWritten++;
        break;
      case "command.exec":
        appState.counters.commandsRun++;
        break;
      case "error":
        appState.counters.errors++;
        appState.ui.showErrorFeedback = true;
        appState.ui.errorMsg = payload.meta?.message ?? "Unknown error";
        break;
      case "done":
        appState.aiState = "done";
        break;
    }
  });
  return unlisten;
}
```

- Frontend: NewsTicker.svelte（示例）

```svelte name=src/components/NewsTicker.svelte
<script lang="ts">
  import { appState } from "$lib/stores.svelte";
  import { onDestroy } from "svelte";
  import { open } from "@tauri-apps/api/shell";

  let interval: ReturnType<typeof setInterval> | null = null;

  $: news = appState.news ?? [];
  $: idx = appState.newsIndex ?? 0;

  function startRotate() {
    if (interval) return;
    interval = setInterval(() => {
      if (!appState.showNews) return;
      appState.newsIndex = (appState.newsIndex + 1) % Math.max(1, (appState.news?.length ?? 1));
    }, 4000);
  }
  function stopRotate() {
    if (interval) { clearInterval(interval); interval = null; }
  }

  $: if (appState.showNews && news.length > 0) startRotate(); else stopRotate();

  onDestroy(() => stopRotate());

  function openItem(item) { if (item?.link) void open(item.link); }
</script>

{#if appState.showNews && news.length > 0}
  <div class="news-overlay" on:click={() => appState.showNews = false}>
    <div class="chip">
      <strong class="src">{appState.news[appState.newsIndex].source}</strong>
      <button class="close" on:click={(e)=>{ e.stopPropagation(); appState.showNews=false; }}>✕</button>
    </div>
    <div class="headline" on:click={() => openItem(appState.news[appState.newsIndex])}>
      {appState.news[appState.newsIndex].title}
    </div>
  </div>
{/if}

<style>
/* 样式略 — 同上文示例 */
</style>
```

---

结语与下一步（我已完成的事与可继续行动）

- 我已把之前讨论的所有要点、协议、插件化设计、示例实现与迭代计划整合成这份最终文档。
- 下一步我可以按你的选择继续：
  1. 直接实现 M1（在 src-tauri 添加 mcp listener 并在前端接收事件），并提交 PR。
  2. 实现 M2（news 插件，后端抓取 + 前端展示），并提交 PR。
  3. 把本文件保存到仓库 docs/final_plan.md（我可以创建一个分支并提交变更）。

告诉我你想让我现在做哪一步（或都做），我会立即开始并在当前分支上提交补丁 / PR。
