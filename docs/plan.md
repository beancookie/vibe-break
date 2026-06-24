# 🎮 Vibe Break — 最终技术方案

一份面向程序员的趣味工具箱方案，将 AI 编程助手的思考过程实时可视化为 3D 互动场景。

## 📌 一、项目概述

Vibe Break 是一款为习惯终端工作的程序员设计的趣味工具箱，核心价值在于将等待 AI 生成代码、编译、部署等碎片时间转化为带有视觉娱乐反馈的轻松时刻。

项目以**统一的 Rust 可执行文件**形态交付，将 Bevy 3D 引擎与 MCP 服务器嵌入同一进程，与 Claude Code 通过 MCP 协议深度集成，实时捕获 AI 的工作状态并驱动 3D 画面做出对应反馈。

## 🎯 二、核心功能

| 功能 | 说明 |
|------|------|
| 实时状态可视化 | Claude Code 思考、改文件、执行命令时，3D 场景自动切换对应动画 |
| 摸鱼新闻弹幕 | 滚动显示程序员梗段子，可选内置段子 / 真实热搜 / AI 生成 |
| 日志统计日报 | 读取本地历史记录，统计 AI 交互次数、文件修改量、中断频率 |
| AI 毒舌点评 | 基于统计数据调用大模型，生成幽默风格的开发者日报 |

## 🧩 三、技术选型

- **宿主程序** — Rust，兼顾高性能、跨平台和内存安全
- **3D 引擎** — Bevy，Rust 生态最活跃的 ECS 架构引擎，原生 glTF 支持，社区驱动
- **MCP 服务器** — Rust MCP 库（`rust-mcp-sdk` / `turbomcp` / `mcpx`），嵌入宿主进程，无额外运行时
- **通信协议** — MCP 协议（stdio），宿主进程内直接通信，零 IPC 开销
- **AI 接口** — 兼容 OpenAI 格式，支持 DeepSeek、通义千问等，用户自带 API Key
- **3D 模型格式** — glTF（.glb/.gltf）首选，Bevy 原生支持
- **跨平台策略** — 原生编译，单文件分发，无需任何运行时环境

## 🔄 四、系统架构

架构简化为两个组件：

```
┌─────────────────────────────────┐
│         Vibe Break (Rust)        │
│  ┌───────────┐  ┌─────────────┐  │
│  │  Bevy 3D  │  │ MCP Server  │  │
│  │   引擎     │◄─┤  (内嵌)     │  │
│  │   + UI    │  │   stdio      │  │
│  └───────────┘  └──────┬──────┘  │
│                         │         │
│  ┌──────────────────────┘         │
│  │  CLI 层 (日志/配置/AI API)     │
│  └─────────────────────────────────┘
│          │ MCP (stdio)
│          ▼
│  ┌──────────────┐
│  │  Claude Code  │
│  │  (MCP 客户端)  │
│  └──────────────┘
```

**Vibe Break (Rust)** — 统一应用，内部包含三个逻辑层：
- **CLI 层** — 读取本地日志、调用 AI API、管理配置、处理命令行参数
- **MCP Server** — 通过 `rust-mcp-sdk` / `turbomcp` 实现，作为独立线程运行，通过 stdio 与 Claude Code 通信
- **Bevy 3D 引擎** — 通过 System + Event 模式接收 MCP 层转发的状态事件，驱动 3D 场景动画

**Claude Code** — MCP 客户端，通过 stdio 与宿主进程内的 MCP Server 直连。

### 🦀 Rust MCP 实现路径

Rust 生态中有多个生产级的 MCP 实现：

| 库 | 特点 |
|----|------|
| `rust-mcp-sdk` | 功能全面，提供构建 MCP 服务器的完整 API |
| `turbomcp` | 高性能，异步优先 |
| `mcpx` | 极简，轻量 |

选择任一库在 Rust 中实现 MCP Server，然后通过 **Bevy Event + System** 驱动游戏循环：

```rust
#[derive(Event)]
enum MCPEvent {
    Thinking,
    Editing(String),
    Executing(String),
    Done,
}

fn handle_mcp_events(
    mut ev_rx: EventReader<MCPEvent>,
    mut query: Query<&mut Transform, With<AICore>>,
    mut particles: Query<&mut ParticleEmitRate>,
) {
    for ev in ev_rx.read() {
        match ev {
            MCPEvent::Thinking => { /* 匀速旋转 */ }
            MCPEvent::Editing(_) => { /* 脉动发光，粒子增强 */ }
            MCPEvent::Executing(_) => { /* 轻微抖动 */ }
            MCPEvent::Done => { /* 爆炸特效 */ }
        }
    }
}
```

MCP Server 接收到的指令通过 Bevy 的 EventWriter 发送，System 在每帧自动处理，ECS 架构天然解耦，扩展性强。

## 📂 五、目录结构

```
/
├── src/
│   ├── main.rs              # 入口，初始化 Bevy App + MCP Server
│   ├── cli.rs                # CLI 命令解析（含 --no-game 等参数）
│   ├── log_reader.rs         # Claude Code / Codex / OpenCode 日志读取
│   ├── ai_client.rs          # AI API 客户端（OpenAI 兼容格式）
│   ├── config.rs             # 配置管理 (~/.vibreak/config.json)
│   ├── jokes.rs              # 内置段子库
│   ├── mcp_server.rs         # Rust MCP Server（stdio + 事件转发）
│   ├── events.rs             # MCPEvent 定义
│   ├── systems/
│   │   ├── animation.rs      # 模型动画 System
│   │   ├── particles.rs      # 粒子系统
│   │   └── ui.rs             # UI 文字滚动 System
│   └── plugins/
│       └── mcp_plugin.rs     # Bevy Plugin，注册 Event + System
├── assets/
│   ├── models/
│   ├── textures/
│   ├── materials/
│   └── fonts/
├── builds/                   # 各平台编译产物
└── Cargo.toml
```

整个项目一个 Cargo 包，无外部依赖进程。

## 🔌 六、MCP 数据链路

MCP Server 内嵌在宿主进程中，通过 stdio 与 Claude Code 通信，采用双路数据采集：

**主动路径** — Claude Code 通过系统提示调用 `send_thought_to_vibreak` 工具，将实时状态经 stdio 推送给内嵌 MCP Server，MCP Server 通过 EventWriter 写入 Bevy 事件队列。

**被动路径** — 文件监听线程轮询 `~/.claude/history.jsonl`，任何落盘记录都会被解析并写入 Bevy 事件队列。

双路数据最终汇聚到 Bevy EventReader，由 `handle_mcp_events` System 驱动 3D 画面保持同步。

## 🎮 七、3D 场景反馈机制

| 状态 | 动画反馈 | UI 显示 |
|------|---------|---------|
| 思考中 | AI 核心模型匀速旋转，粒子系统平稳环绕 | "AI 思考中..." |
| 修改文件 | 核心模型脉动发光，粒子强度提升 | 正在修改的文件名 |
| 执行命令 | 核心模型产生轻微抖动 | — |
| 完成 | 爆炸或缩放特效，粒子系统爆发 | "完成！" |

## 📁 八、数据来源

- **Claude Code** — `~/.claude/history.jsonl`（全局），`.claude/projects/`（项目会话）
- **Codex** — `.codex/sessions/`（JSON）
- **OpenCode** — `.local/share/opencode/log/`

Rust 通过 `dirs::home_dir()` 统一获取用户主目录路径，自动适配各平台。

## 🎨 九、3D 模型管理

Bevy 原生支持 **glTF（.glb/.gltf）**，首选此格式。MMD 模型（PMX）需在 Blender 中用 Cats 插件转换为 glTF 后使用。

推荐来源：Sketchfab、Poly Haven、模之屋。商用需核查授权协议。

## 🚀 十、开发计划

| 阶段 | 内容 |
|------|------|
| 一 | Rust CLI 骨架：配置管理 + AI API 基础调用 |
| 二 | Bevy 3D 场景：模型加载 + 基础动画 |
| 三 | Rust MCP Server：实现 MCP 协议 + Bevy Plugin 集成 |
| 四 | 完整数据链路打通：MCP → Event → System → 3D 动画 |
| 五 | 视觉打磨 + 跨平台打包 + 文档 |

预计 **两周** 左右。

## 📦 十一、跨平台交付

单文件分发：

- **macOS** — 编译为通用二进制 `.app` 包
- **Windows** — 编译为 `.exe` 文件，资源全部打包进单一文件

用户无需安装任何运行时，下载即用。

## ⚙️ 十二、用户配置

`~/.vibreak/config.json`：

- AI 服务的 API Key 和 Base URL
- 默认模型名称
- 是否启用 3D 窗口
- 摸鱼新闻模式（内置段子 / 真实热搜 / AI 生成）
- 自定义段子列表

## 🛡 十三、注意事项

- **启动顺序** — 先启动 Vibe Break（同时启用 MCP Server 和 3D 窗口），然后在 Claude Code 中加载 MCP 配置
- **文件权限** — 需读取 `~/.claude/` 目录的权限
- **降级方案** — `--no-game` 参数关闭 3D 窗口，退化为纯终端模式
- **版权合规** — 第三方 3D 模型注意授权协议

## 🎯 十四、使用流程

1. 在 Claude Code 项目目录配置 MCP 指向 Vibe Break 可执行文件
2. 运行 `vibe-break` 启动 3D 窗口并等待 Claude Code 连接
3. 在另一终端正常使用 Claude Code，3D 窗口自动跟随 AI 状态切换动画

---

本方案以**全线 Rust** 统一技术栈，通过 Bevy ECS + Rust MCP 库将 3D 引擎与 MCP Server 嵌入同一进程。最终交付物为**单个可执行文件**，用户下载即用，无需管理多进程，零 IPC 开销，响应更及时。
