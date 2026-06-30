# Vibe Break

一个基于 **Tauri 2 + Svelte 5 + Three.js** 的桌面应用，用于加载并展示 **VRM** 3D 模型与 **VRMA** 动画，集成 MCP Server 与 Claude Code 等 AI 编码助手实时交互，并展示社区热点新闻弹幕。

> 把等代码、编译、部署的碎片时间，交给一个可爱的桌面宠物陪你度过。

## 🎬 演示

![Demo](./docs/demo.gif)

## ✨ 特性

- 🎏 通过 Three.js 渲染 VRM 3D 角色
- 🎭 支持加载多个 VRM 模型（自动扫描 `assets/` 目录）
- 🕺 内置 19 个 VRMA 动画（Angry / Blush / Clapping / Goodbye / Jump / LookAround / Relax / Sad / Sleepy / Surprised / Thinking 等）
- 🧭 滚轮缩放模型，窗口按 3:4 比例自适应大小
- 🪟 跨平台桌面端打包（Tauri 2：Windows / macOS / Linux）
- 🔁 VRMA 动画 `LoopPingPong` 循环播放，消除跳帧
- 💾 自动持久化偏好（选中模型、动画、缩放、窗口置顶）
- 🤖 内置 **MCP Server**（`streamable-http`，端口 39876），支持 13 个 tool（6 个报告 tool + 7 个操作 tool）
- 💬 **EncouragementBubble** 打字机气泡，MCP message 实时显示，嘴部 BlendShape 联动
- 📰 **新闻 Barrage 弹幕**：Rust Lua 爬虫引擎从 V2EX / 掘金拉取热点，CSS 弹幕滚动展示
- 🪟 透明无边框窗口 + long-press 窗口拖拽

## 🛠 技术栈

- **前端**: Svelte 5（runes）+ TypeScript + Vite 6
- **3D 渲染**: Three.js + [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) + [@pixiv/three-vrm-animation](https://github.com/pixiv/three-vrm-animation)
- **场景框架**: [Threlte](https://threlte.xyz/)（Svelte 适配的 Three.js 声明式封装）
- **桌面壳**: Tauri 2（Rust）
- **MCP 协议**: `pmcp`（Streamable HTTP）
- **新闻爬虫**: `mlua`（Lua 54 sandbox）+ `scraper`（HTML 解析）+ `reqwest`
- **持久化**: `@tauri-apps/plugin-store`
- **资源协议**: Tauri 的 `protocol-asset`，通过 `convertFileSrc` 加载本地资源

## 📦 项目结构

```
vibe-break/
├── src/                              # Svelte 前端源码
│   ├── components/
│   │   ├── Scene/                    # 3D 场景组件
│   │   │   ├── Scene.svelte          # 场景编排
│   │   │   ├── VrmModel.svelte       # VRM 渲染 + 动画/表情/Bone 控制
│   │   │   ├── CameraRig.svelte      # 相机 + 透明背景 + 窗口拖拽
│   │   │   ├── OrbitControls.svelte  # 轨道控制（仅滚轮缩放到 petScale）
│   │   │   └── Lighting.svelte       # 四点光源
│   │   ├── UI/
│   │   │   ├── VrmContextMenu.svelte      # 右键/双击上下文菜单
│   │   │   ├── EncouragementBubble.svelte # 打字机鼓励气泡
│   │   │   ├── Barrage.svelte             # 新闻弹幕管理器
│   │   │   └── BarrageItem.svelte         # 单条弹幕（CSS 滚动）
│   │   └── VrmViewer.svelte          # 顶层组件（Canvas + 持久化）
│   ├── lib/
│   │   ├── stores.svelte.ts          # 全局响应式状态（$state）
│   │   ├── mcpBridge.svelte.ts       # MCP Tauri event listener
│   │   ├── three/
│   │   │   ├── useVrm.ts             # VRM/VRMA 加载管线
│   │   │   ├── loadAssets.ts         # invoke list_assets
│   │   │   └── assetUrl.ts           # asset:// URL 解析
│   │   ├── persisted.ts              # Store 持久化
│   │   ├── useWindowDrag.svelte.ts   # long-press 窗口拖拽
│   │   ├── strings.ts                # UI 字符串常量
│   │   ├── logger.ts                 # 结构化日志
│   │   ├── errors.ts                 # 自定义错误类型
│   │   ├── utils.ts                  # cn() 工具函数
│   │   ├── devLog.ts                 # 开发调试日志
│   │   ├── devMock.ts                # 开发模式 mock 数据
│   │   ├── components/ui/            # shadcn-style UI 原语
│   │   │   ├── button.svelte
│   │   │   ├── separator.svelte
│   │   │   └── label.svelte
│   │   └── __tests__/
│   │       ├── strings.test.ts       # 字符串常量测试
│   │       └── logger.test.ts        # 日志工具测试
│   ├── app.css                       # Tailwind v4 入口
│   └── main.ts                       # 应用入口（恢复持久化 + 扫描 + MCP + 新闻轮询）
├── src-tauri/                        # Tauri Rust 后端
│   ├── src/
│   │   ├── lib.rs                    # list_assets / fetch_news / block_news + 窗口约束
│   │   ├── main.rs
│   │   ├── mcp_server/
│   │   │   ├── mod.rs                # 13 个 MCP tool 注册 + server start
│   │   │   ├── handler.rs            # handle_report / handle_tool_call
│   │   │   └── event.rs             # ActionCommand + parse_event / parse_event_type
│   │   └── crawler/
│   │       ├── mod.rs                # CrawlerPlugin trait + fetch_news command
│   │       ├── cache.rs              # DedupCache（3 天 TTL）
│   │       ├── engine.rs             # Lua 插件加载
│   │       └── plugin.rs             # Lua sandbox + HTTP 请求 + HTML 解析
│   ├── resources/
│   │   ├── assets/                   # VRM 模型（7 个）
│   │   │   └── vrma/                 # VRMA 动画（19 个）
│   │   └── crawlers/                 # Lua 爬虫脚本（v2ex.lua / juejin.lua）
│   ├── capabilities/default.json     # 权限配置
│   ├── Cargo.toml
│   └── tauri.conf.json
├── .mcp.json                         # MCP Server 配置（Claude Code 等连接用）
├── opencode.json                     # MCP Server 配置（opencode 连接用）
├── .claude.json                      # Claude Code 项目指引
├── eslint.config.js
├── vitest.config.ts
├── .prettierrc
└── package.json
```

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **pnpm** >= 8
- **Rust** 工具链（[安装](https://rustup.rs/)）
- Tauri 2 系统依赖，详见 [Tauri 官方文档](https://tauri.app/start/prerequisites/)

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm tauri dev
```

启动后会自动运行 Vite 开发服务器并打开 Tauri 窗口。选中模型和缩放比例会自动持久化，重启后恢复。

### 构建发布

```bash
pnpm tauri build
```

产物输出到 `src-tauri/target/release/bundle/`。

## 🧪 测试

```bash
pnpm test          # 运行一次
pnpm test:watch    # 监听模式
```

## 🎨 添加模型 / 动画

模型和动画在应用启动时由 Rust 端自动扫描，无需改前端代码：

1. 将 `.vrm` 文件放入 `src-tauri/resources/assets/`
2. 将 `.vrma` 文件放入 `src-tauri/resources/assets/vrma/`
3. 重启应用（`pnpm tauri dev` 或重新构建）

资源通过 Tauri 的 `asset://` 协议加载。

## 📜 可用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Vite 开发服务器（纯浏览器，不会加载模型） |
| `pnpm build` | `svelte-check` 类型检查并构建前端 |
| `pnpm check` | 仅运行类型检查 |
| `pnpm lint` | ESLint 检查 |
| `pnpm test` | 运行单元测试 |
| `pnpm test:watch` | 监听模式测试 |
| `pnpm format:check` | 检查代码格式 |
| `pnpm preview` | 预览构建产物 |
| `pnpm clean` | 清理构建产物（dist / node_modules / target） |
| `pnpm tauri dev` | 启动 Tauri 开发模式 |
| `pnpm tauri build` | 打包桌面应用 |

## 🤖 MCP 配置

本项目内置了 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) Server（端口 39876），允许 AI 编程助手直接与运行时交互。

### MCP Server 启动

MCP Server 随 Tauri 应用自动启动，绑定 `127.0.0.1:39876`。应用关闭后无法连接。

### MCP Client 配置

#### Claude Code

**方式一：命令行（推荐）**

```bash
claude mcp add vibe-break --transport http http://127.0.0.1:39876/
```

变更配置需先移除再添加：

```bash
claude mcp remove vibe-break
claude mcp add vibe-break --transport http http://127.0.0.1:39876/
```

查看已配置的 MCP 服务器：

```bash
claude mcp list
# 或在 Claude Code 中运行 /mcp
```

**方式二：配置文件（`.mcp.json`）**

项目根目录已包含 `.mcp.json`：

```json
{
  "mcpServers": {
    "vibe-break": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:39876/"
    }
  }
}
```

配置生效后，在 Claude Code 中运行 `/mcp restart` 重启即可。

#### opencode

项目根目录已包含 `opencode.json`，opencode 启动后自动读取：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "vibe-break": {
      "type": "remote",
      "url": "http://127.0.0.1:39876/"
    }
  }
}
```

也可以添加到全局配置 `~/.config/opencode/opencode.json`。

#### 其他编辑器

| 编辑器 | 配置方式 |
|--------|----------|
| **Cursor** | 设置 → MCP Server → Add → `http://127.0.0.1:39876/`，或使用项目 `.mcp.json` |
| **Windsurf** | 设置中添加 MCP 端点 `http://127.0.0.1:39876/` |
| **Continue (VS Code 插件)** | 在 `~/.continue/config.json` 中添加 `experimental.mcpServers` |

#### 配置文件位置汇总

| 位置 | 工具 | 作用域 |
|------|------|--------|
| 项目根目录 `.mcp.json` | Claude Code / Cursor | 仅当前项目 |
| 项目根目录 `opencode.json` | opencode | 仅当前项目 |
| `~/.claude/settings.json` | Claude Code | 全局 |
| `~/.claude/settings.local.json` | Claude Code | 全局（不提交 git），优先级最高 |
| `~/.config/opencode/opencode.json` | opencode | 全局 |

### 给其他项目安装

要让你自己的项目也能连接 vibe-break，只需在目标项目根目录创建对应配置文件：

**opencode** — `opencode.json`：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "vibe-break": {
      "type": "remote",
      "url": "http://127.0.0.1:39876/"
    }
  }
}
```

**Claude Code** — `.mcp.json`：

```json
{
  "mcpServers": {
    "vibe-break": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:39876/"
    }
  }
}
```

**其他编辑器**：参照上表配置 MCP Server 端点 `http://127.0.0.1:39876/`。

> Vibe-break 应用必须保持运行状态才能接受 MCP 连接。

### 支持的 Tools

| Tool | 说明 |
|------|------|
| `report_write` | 报告文件写入/编辑事件 |
| `report_read` | 报告文件读取事件 |
| `report_bash` | 报告命令执行事件 |
| `report_search` | 报告代码搜索事件 |
| `report_done` | 报告任务完成 |
| `report_error` | 报告错误 |
| `list_vrm_models` | 列出所有 VRM 模型 |
| `list_vrma_animations` | 列出所有 VRMA 动画 |
| `select_model` | 切换到指定 VRM 模型 |
| `play_animation` | 播放指定 VRMA 动画 |
| `set_scale` | 调整模型缩放比例（0.1 ~ 10.0） |
| `set_always_on_top` | 设置窗口置顶 |
| `get_status` | 获取当前状态 |

### 配合 Claude Code 使用

1. 确保 Tauri 应用正在运行（`pnpm tauri dev`）
2. 项目根目录已包含 `.claude.json`，配置了 MCP 使用指引
3. 在 Claude Code 中可直接通过自然语言控制应用或获得编码可视化反馈：
   - *"切换到 xxx 模型"*
   - *"播放 xxx 动画"*
   - *"把模型放大到 2 倍"*
   - *"将窗口置顶"*
   - *"当前是什么模型？"*

### 编码可视化反馈

| 事件 | VRM 反应 |
|------|----------|
| 思考中（report_* → thinking） | 播放 `Thinking` 动画 |
| 任务完成（report_done） | 播放 `Clapping` 动画 |
| 出错（report_error） | 播放 `Sad` 动画，设置 errorMsg |
| 写文件（report_write） | 计数 filesWritten +1 |
| 执行命令（report_bash） | 计数 commandsRun +1 |
| 读文件（report_read）/ 搜索（report_search） | 显示 message 气泡 |

所有 report tool 都支持通过 `tool_input.actions` 数组下发动作指令：

```json
{
  "message": "Just wrote the auth middleware!",
  "tool_input": {
    "actions": [
      { "type": "play_anim", "name": "Clapping" },
      { "type": "expression", "name": "happy", "weight": 0.8 }
    ]
  }
}
```

## 🏗 架构概要

### 状态管理

`appState` 使用 Svelte 5 `$state()` rune 定义在 `stores.svelte.ts` 中，是全局响应式对象。包含 VRM 状态（selectedVrm / selectedAnim / petScale）、AI 状态（aiState / counters / thinkingPeriods）、UI 状态（mcpUi / news / showNews）、以及 MCP 动作指令（pendingExpression / pendingBonePose / mouthWeight）。

持久化：`persisted.ts` 使用 `@tauri-apps/plugin-store` 在 `settings.json` 中保存用户偏好（selectedVrm / selectedAnim / petScale / alwaysOnTop），`VrmViewer.svelte` 中的 `$effect` 自动同步。

### 3D 场景主循环

```
VrmViewer (Canvas + Threlte)
  └─ Scene
       ├─ CameraRig (PerspectiveCamera + 透明背景 + ACESFilmic + 窗口拖拽)
       ├─ Lighting (AmbientLight + 3 个 DirectionalLight)
       ├─ VrmModel (VRM 加载/卸载 + 动画交叉淡入淡出 + 表情/Bone/嘴部控制 + 窗口 resize)
       └─ OrbitControls (禁用所有鼠标按钮交互，仅滚轮 → petScale)
```

### 资源加载流程

```
main.ts
  ├─ loadPersistedState()           ← 恢复上次选中的模型/动画/缩放/置顶
  ├─ scanAssets()
  │    ├─ listAssets()              ← invoke Rust list_assets → 扫描 assets/
  │    └─ 更新 vrmList / animList + 自动选择首个
  ├─ startMcpBridge()               ← listen("mcp:event")
  └─ startNewsTimer()               ← invoke fetch_news → 每 10 分钟轮询

VrmModel.svelte $effect → selectedVrm 变化
  └─ startLoad() → loadVRM(url) → fetch → yield → parse → yield → addScene → frameCamera
```

## 🌐 模型 / 动画来源

- [VRM 格式规范](https://vrm.dev/)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- VRMA 示例动画由 [VRM Consortium](https://github.com/vrm-c) 提供

## 📄 License

MIT
