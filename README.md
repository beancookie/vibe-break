# Vibe Break

一个基于 **Tauri 2 + Svelte 5 + three.js** 的桌面应用，用于加载并展示 **VRM** 3D 模型与 **VRMA** 动画。

> 把等代码、编译、部署的碎片时间，交给一个可爱的桌面宠物陪你度过。

## 🎬 演示

![Demo](./docs/demo.gif)

## ✨ 特性

- 🎏 通过 `three.js` 渲染 VRM 3D 角色
- 🎭 支持加载多个 VRM 模型（自动扫描 `assets/` 目录）
- 🕺 内置多个 VRMA 动画（Angry / Blush / Clapping / Goodbye / Jump / LookAround / Relax / Sad / Sleepy / Surprised / Thinking 等）
- 🧭 鼠标拖拽旋转、滚轮缩放（OrbitControls）
- 📐 模型自动取景，窗口按 3:4 比例自适应大小
- 🪟 跨平台桌面端打包（Tauri 2：Windows / macOS / Linux）
- 🔁 VRMA 动画 `LoopPingPong` 循环播放，消除跳帧
- 💾 自动持久化偏好（选中模型、动画、缩放、窗口置顶）
- 🤖 内置 **MCP Server**（`streamable-http`），支持与 Claude Code 等 MCP 客户端交互，通过 AI 直接控制模型切换、动画播放、缩放调整等

## 🛠 技术栈

- **前端**: Svelte 5（runes）+ TypeScript + Vite
- **3D 渲染**: three.js + [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) + [@pixiv/three-vrm-animation](https://github.com/pixiv/three-vrm-animation)
- **场景框架**: [Threlte](https://threlte.xyz/)（Svelte 适配的 three.js 声明式封装）
- **桌面壳**: Tauri 2（Rust）
- **持久化**: `@tauri-apps/plugin-store`
- **资源协议**: `tauri` 的 `protocol-asset`，通过 `convertFileSrc` 加载本地资源

## 📦 项目结构

```
vibe-break/
├── src/                          # Svelte 前端源码
│   ├── components/
│   │   ├── Scene/                # 3D 场景组件（Scene / VrmModel / CameraRig / OrbitControls / Lighting）
│   │   ├── UI/                   # 上下文菜单
│   │   └── VrmViewer.svelte      # 顶层组件（Canvas + 持久化同步）
│   ├── lib/
│   │   ├── three/                # useVrm / assetUrl / loadAssets
│   │   ├── stores.svelte.ts      # 全局响应式状态（$state + setter 方法）
│   │   ├── runtime.ts            # 统一 isTauri / invoke / 错误类型
│   │   ├── persisted.ts          # Store 持久化加载/保存
│   │   ├── strings.ts            # 集中管理所有 UI 字符串
│   │   ├── types.ts              # AssetEntry 等类型定义
│   │   └── __tests__/            # 单元测试
│   ├── app.css                   # Tailwind 入口
│   └── main.ts
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/lib.rs                # list_assets 命令 + 窗口约束 + plugin-store
│   ├── resources/assets/         # 打包资源（.vrm / vrma/*.vrma）
│   ├── capabilities/default.json # 权限配置
│   ├── Cargo.toml
│   └── tauri.conf.json
├── .mcp.json                      # MCP Server 配置（Claude Code 等 AI 客户端连接用）
├── .claude.json                   # Claude Code 项目配置（MCP 使用指引）
├── .github/workflows/ci.yml      # CI（check + lint + test + build）
├── eslint.config.js
├── vitest.config.ts
├── .prettierrc
├── LICENSE
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

启动后会自动运行 Vite 开发服务器（`http://localhost:1420`）并打开 Tauri 窗口。选中模型和缩放比例会自动持久化，重启后恢复。

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

模型和动画在应用启动时由 Rust 端自动扫描，**无需改前端代码**：

1. 将 `.vrm` 文件放入 `src-tauri/resources/assets/`
2. 将 `.vrma` 文件放入 `src-tauri/resources/assets/vrma/`
3. 重启应用（`pnpm tauri:dev` 或 `pnpm tauri dev` 或重新构建）
    - 使用 `pnpm tauri:dev` 会自动同步资源到构建目录

资源通过 Tauri 的 `asset://` 协议加载（`tauri.conf.json` 中已开启 `assetProtocol` 并将 `$RESOURCE/**` 加入 scope）。

## 📜 可用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Vite 开发服务器（纯浏览器，不会加载模型） |
| `pnpm build` | `svelte-check` 类型检查并构建前端 |
| `pnpm check` | 仅运行类型检查 |
| `pnpm lint` | ESLint 检查 |
| `pnpm test` | 运行单元测试 |
| `pnpm test:watch` | 监听模式测试 |
| `pnpm mcp` | 启动 MCP Server（standalone，不启动 GUI） |
| `pnpm format:check` | 检查代码格式 |
| `pnpm preview` | 预览构建产物 |
| `pnpm clean` | 清理构建产物 |
| `pnpm tauri:dev` | 同步资源再启动 Tauri 开发模式（**推荐**） |
| `pnpm tauri dev` | 直接启动 Tauri 开发模式（不自动同步资源） |
| `pnpm tauri build` | 打包桌面应用 |

## 🤖 MCP 配置

本项目内置了 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) Server，允许 AI 编程助手（如 Claude Code）直接与运行时交互。

### MCP Client 配置

Claude Code 内置了 MCP Client 能力，通过以下方式配置：

#### 方式一：命令行配置（推荐）

```bash
claude mcp add vibe-break --transport http http://127.0.0.1:39876/
```

如果配置有变更需先移除再添加：

```bash
claude mcp remove vibe-break
claude mcp add vibe-break --transport http http://127.0.0.1:39876/
```

查看已配置的 MCP 服务器：

```bash
claude mcp list
# 或在 Claude Code 中运行 /mcp
```

#### 方式二：配置文件（`.mcp.json`）

在项目根目录创建 `.mcp.json`：

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

配置文件生效后，在 Claude Code 中运行 `/mcp restart` 重启即可生效。

#### 配置文件位置

| 位置 | 作用域 |
|------|--------|
| 项目根目录 `.mcp.json` | 仅当前项目 |
| `~/.claude/settings.json` | 全局 |
| `~/.claude/settings.local.json` | 全局（不提交 git），优先级最高 |

### 支持的 Tools

| Tool | 说明 |
|------|------|
| `report_event` | 报告 AI 编码事件（Write / Edit / Bash / Read 等），驱动 VRM 可视化反馈 |
| `list_vrm_models` | 列出 assets/ 中的所有 VRM 模型 |
| `list_vrma_animations` | 列出 assets/vrma/ 中的所有 VRMA 动画 |
| `select_model` | 切换到指定 VRM 模型 |
| `play_animation` | 播放指定 VRMA 动画 |
| `set_scale` | 调整模型缩放比例（0.1 ~ 10.0） |
| `set_always_on_top` | 设置窗口置顶 |
| `get_status` | 获取当前状态（模型、动画、缩放、窗口置顶） |

### 配合 Claude Code 使用

1. 确保 Tauri 应用正在运行（`pnpm tauri:dev`）
2. 项目根目录已包含 `.claude.json`，配置了 MCP 使用指引
3. 在 Claude Code 中可直接通过自然语言控制应用或获得编码可视化反馈：
   - *"切换到 xxx 模型"*
   - *"播放 xxx 动画"*
   - *"把模型放大到 2 倍"*
   - *"将窗口置顶"*
   - *"当前是什么模型？"*

### 编码可视化反馈

每次 Claude Code 使用工具时，会通过 `report_event` 自动通知应用，触发 VRM 角色做出对应反应：

| 事件 | VRM 反应 |
|------|----------|
| 思考中（Thinking） | 播放 `Thinking` 动画 |
| 完成任务（Done） | 播放 `Clapping` 动画 |
| 出错（Error） | 播放 `Sad` 动画 |
| 写文件（Write） | 计数增加 |
| 执行命令（Exec） | 计数增加 |
| 读文件（Read） | 计数增加 |

### Studio - 支持对接 MCP 的 AI 编辑器

支持 MCP Client 的编辑器可直接使用本项目提供的 MCP tools：

| 编辑器 | 配置方式 |
|--------|----------|
| **Cursor** | 在 Cursor 设置中配置 MCP Server，或通过项目级 `.mcp.json` |
| **Windsurf** | 在设置中添加 MCP Server 端点 |
| **Continue (VS Code 插件)** | 在 `~/.continue/config.json` 中添加 `experimental.mcpServers` |

> 连接成功后即可通过 AI 助手直接控制模型切换、动画播放、缩放调整等，无需手动操作。

## 🏗 架构概要

### 状态管理

`appState` 使用 Svelte 5 `$state()` rune 定义在 `stores.svelte.ts` 中，是全局响应式对象。所有状态变更通过导出的 setter 函数（`setStatus`、`setVrmList`、`setLoading` 等）执行，以便集中管理副作用。

持久化：`persisted.ts` 使用 `@tauri-apps/plugin-store` 在 `settings.json` 中保存用户偏好（selectedVrm、selectedAnim、petScale、alwaysOnTop），`VrmViewer.svelte` 中的 `$effect` 自动同步。

### 3D 场景主循环

```
VrmViewer (Canvas + Threlte)
  └─ Scene
       ├─ CameraRig (PerspectiveCamera + 窗口拖拽 + lookTarget 更新)
       ├─ Lighting (Ambient + Directional)
       ├─ VrmModel (VRM 加载/卸载 + 动画 playback + 窗口 resize)
       └─ OrbitControls (旋转/缩放 → petScale)
```

### 资源加载流程

```
main.ts
  ├─ loadPersistedState()   ← 恢复上次选中的模型/动画/缩放
  ├─ listAssets()           ← invoke Rust list_assets → 扫描 assets/
  ├─ 更新 vrmList/animList
  └─ VrmModel.svelte $effect 监听到 selectedVrm 变化
       └─ startLoad() → loadVRM(url) → fetch → parse → 添加到 scene → frameVRM
```

## 🌐 模型 / 动画来源

- [VRM 格式规范](https://vrm.dev/)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- VRMA 示例动画由 [VRM Consortium](https://github.com/vrm-c) 提供

## 📄 License

MIT — 详见 [LICENSE](./LICENSE)。
