# 🎮 Vibe Break — 项目方案

一个桌面端的 **VRM 3D 模型查看器 + VRMA 动画播放器**，把等代码、编译、部署的碎片时间交给一个可爱的桌面宠物陪你度过。

> ⚠️ 文档中带有 `📍 当前` / `🎯 目标` 标记。
> `📍 当前` = 代码里已经实现的真实状态
> `🎯 目标` = 项目愿景 / 计划中但尚未实现

## 📌 一、项目定位

Vibe Break 是一个**桌面端的 VRM 角色查看器**。

**📍 当前阶段**：可用的桌面应用，支持加载多个 VRM 模型、播放 VRMA 动画、自动取景、自适应窗口缩放。

**🎯 目标阶段**：与 Claude Code 通过 MCP 协议深度集成，实时捕获 AI 工作状态（思考 / 改文件 / 执行命令 / 完成）并驱动 3D 画面做出对应反馈；附加摸鱼新闻弹幕、日志统计日报、AI 毒舌点评等趣味功能。

## 🎯 二、核心功能

### 📍 当前已实现

| 功能 | 说明 |
|------|------|
| VRM 模型加载 | 支持 VRM 0.x / 1.x，通过 `@pixiv/three-vrm` 加载 |
| VRMA 动画播放 | 支持多个 `.vrma` 动画，`LoopPingPong` 循环消除跳帧 |
| 模型切换 | UI 下拉菜单选择模型，debounce + loadToken 防止竞态 |
| 鼠标交互 | 拖拽旋转相机、滚轮缩放窗口（**窗口大小同步模型**） |
| 自动取景 | 根据人型骨骼 (head / feet) 计算取景距离 |
| 窗口比例 | 锁定 3:4 (W:H)，Rust 端约束 + JS 端 resizeWindowToVRM |
| 资源扫描 | Rust 端启动时扫描 `$RESOURCE/assets/`，无需改前端代码 |

### 🎯 目标扩展（未实现）

| 功能 | 说明 |
|------|------|
| MCP 集成 | 嵌入 Rust MCP Server（`rust-mcp-sdk` / `turbomcp`），与 Claude Code 通过 stdio 通信 |
| 实时状态可视化 | Claude Code 思考 / 改文件 / 执行命令时，3D 场景自动切换对应动画 |
| 摸鱼新闻弹幕 | 滚动显示程序员梗段子（内置段子 / 真实热搜 / AI 生成） |
| 日志统计日报 | 读取 `~/.claude/history.jsonl`，统计 AI 交互次数、文件修改量 |
| AI 毒舌点评 | 基于统计数据调用大模型生成日报 |

## 🧩 三、技术选型

### 📍 当前栈

| 层 | 选型 | 说明 |
|----|------|------|
| 桌面壳 | **Tauri 2** | Rust 后端 + WebView 前端，单进程 |
| 前端框架 | **Svelte 5**（runes） | 状态/响应式 |
| 场景封装 | **Threlte** | Svelte 适配的 three.js 声明式 API |
| 3D 引擎 | **three.js** | 渲染 |
| VRM | **@pixiv/three-vrm** | VRM 0.x / 1.x，MToon 着色 |
| VRMA 动画 | **@pixiv/three-vrm-animation** | VRMA 解析 |
| 样式 | **Tailwind CSS v4** | UI |
| 资源协议 | **Tauri protocol-asset** | `convertFileSrc` 加载本地资源 |
| 构建 | Vite + pnpm | 前端 HMR + 打包 |

### 🎯 目标栈

| 层 | 选型 | 说明 |
|----|------|------|
| 宿主 | Rust 单进程 | Bevy 3D + MCP Server 内嵌 |
| 3D 引擎 | Bevy | ECS 架构，原生 glTF |
| MCP | `rust-mcp-sdk` / `turbomcp` | stdio 通信 |
| AI 接口 | OpenAI 兼容 | 支持 DeepSeek / 通义千问等 |

> 目标阶段会把当前 Tauri 2 + Svelte 5 前端替换为 Bevy 原生 UI（egui / bevy_ui），删除 WebView 依赖。

## 🔄 四、系统架构

### 📍 当前架构

```
┌──────────────────────────────────────────────────────┐
│                Tauri 2 (单进程)                       │
│                                                      │
│  ┌──────────┐    ┌──────────────────────────────┐    │
│  │  WebView  │    │       Rust 后端              │    │
│  │  Svelte 5 │    │   - list_assets 命令         │    │
│  │  Threlte  │◄──►│   - 窗口事件 Resized 约束     │    │
│  │  three.js │ IPC│   - 启动时注册资源目录        │    │
│  │  + 沙盒    │    │                              │    │
│  └──────────┘    └──────────────────────────────┘    │
│         │                                            │
│         │ asset:// 协议                              │
│         ▼                                            │
│  ┌──────────────────┐                                │
│  │ $RESOURCE/assets │                                │
│  │   *.vrm / *.vrma │                                │
│  └──────────────────┘                                │
└──────────────────────────────────────────────────────┘
```

**前端**（Svelte 5 + Threlte）：
- 启动时 `invoke("list_assets")` 拿资源列表
- `VrmModel.svelte` 负责模型加载 / 动画播放 / 取景 / 窗口 resize
- `OrbitControls.svelte` 把滚轮事件映射到 `appState.petScale`（同时缩放模型 + 窗口）
- `CameraRig.svelte` 处理长按拖动窗口 / 鼠标移动驱动 lookAt

**Rust 后端**（`src-tauri/src/lib.rs`）：
- `list_assets` — 扫描 `resource_dir/assets/`，返回 `{name, url}` 列表
- `on_window_event(Resized)` — 计算新宽度并 `set_size` 校正比例

### 🎯 目标架构

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

## 📂 五、目录结构

### 📍 当前

```
vibe-break/
├── src/                          # Svelte 5 前端
│   ├── components/
│   │   ├── Scene/                # VrmModel / CameraRig / OrbitControls
│   │   ├── UI/                   # VrmContextMenu
│   │   └── VrmViewer.svelte
│   ├── lib/
│   │   ├── three/                # useVrm / assetUrl / loadAssets
│   │   └── stores.svelte.ts      # appState 全局状态
│   ├── app.css                   # Tailwind 入口
│   └── main.ts
├── src-tauri/                    # Tauri 2 Rust 后端
│   ├── src/lib.rs                # list_assets + 窗口约束
│   ├── resources/assets/         # VRM / VRMA 资源
│   ├── capabilities/default.json # Tauri 权限
│   ├── Cargo.toml
│   └── tauri.conf.json
├── public/                       # 静态资源（仅图标）
├── docs/
│   └── plan.md
├── index.html
├── package.json
└── vite.config.ts
```

### 🎯 目标

```
vibe-break/
├── src/
│   ├── main.rs                   # 入口：Bevy App + MCP Server
│   ├── cli.rs                    # --no-game 等参数
│   ├── log_reader.rs             # Claude Code 日志解析
│   ├── ai_client.rs              # OpenAI 兼容 API
│   ├── config.rs                 # ~/.vibreak/config.json
│   ├── jokes.rs                  # 内置段子库
│   ├── mcp_server.rs             # Rust MCP Server
│   ├── events.rs                 # MCPEvent 定义
│   ├── systems/                  # Bevy System
│   │   ├── animation.rs
│   │   ├── particles.rs
│   │   └── ui.rs
│   └── plugins/
│       └── mcp_plugin.rs         # Bevy Plugin
├── assets/
│   ├── models/   textures/   materials/   fonts/
├── builds/
└── Cargo.toml                    # 单一 Cargo 包
```

## 🔌 六、当前资源加载管线

```
┌──────────────────────────────────────────────────────────────┐
│  启动                                                        │
│                                                              │
│  1. main.ts → invoke("list_assets") → 拿 vrm/vrma 列表       │
│                                                              │
│  2. 用户选模型 → debounce 200ms → startLoad(idx)             │
│       ├─ fetch buffer（asset:// 协议，Tauri IO 线程）        │
│       ├─ yield → parse（GLTFLoader + VRMLoaderPlugin）       │
│       ├─ yield → frameVRM（自动取景）+ resizeWindowToVRM     │
│       └─ scene.remove(old) + scene.add(new)                  │
│                                                              │
│  3. 用户选动画 → $effect → mixer.clipAction(LoopPingPong)    │
│                                                              │
│  4. 每帧：useTask → vrm.update(dt) + mixer.update(dt)        │
└──────────────────────────────────────────────────────────────┘
```

## 🎮 七、3D 场景反馈机制

### 📍 当前

| 交互 | 反馈 |
|------|------|
| 鼠标拖拽 | 相机轨道旋转（OrbitControls） |
| 鼠标滚轮 | petScale 改变 → 模型 + 窗口同步缩放（30%~300%） |
| 加载模型 | 自动取景，窗口按 3:4 比例 resize |
| 选动画 | VRMA 替换当前动画，LoopPingPong 无限循环 |

### 🎯 目标

| 状态 | 动画反馈 | UI |
|------|---------|-----|
| 思考中 | AI 核心模型匀速旋转，粒子系统平稳环绕 | "AI 思考中..." |
| 修改文件 | 核心模型脉动发光，粒子强度提升 | 正在修改的文件名 |
| 执行命令 | 核心模型产生轻微抖动 | — |
| 完成 | 爆炸或缩放特效，粒子系统爆发 | "完成！" |

## 🎨 八、3D 模型管理

### 📍 当前：VRM / VRMA

- 模型格式：**VRM**（`.vrm`），通过 `@pixiv/three-vrm` 加载
- 动画格式：**VRMA**（`.vrma`），通过 `@pixiv/three-vrm-animation` 加载
- 放置位置：`src-tauri/resources/assets/*.vrm` + `src-tauri/resources/assets/vrma/*.vrma`
- 添加方式：丢文件到上述目录 + 重启应用，**无需改前端代码**
- 资源协议：Tauri `asset://` + `$RESOURCE/**` scope

推荐来源：模之屋、VRoid Hub、Sketchfab。商用需核查授权协议。

### 🎯 目标：glTF

- Bevy 原生支持 glTF（`.glb` / `.gltf`）
- MMD / PMX 模型需在 Blender 用 Cats 插件转换

## 🧠 九、关键技术决策与原因

### 1. 为什么用 Threlte 而不是裸 three.js

- 声明式：Svelte 组件树和 scene graph 一一对应
- 生命周期托管：`useTask` 自动清理
- 响应式相机/控制器：`useThrelte()` 直接拿到 scene / camera

### 2. 为什么 VRMA 循环用 `LoopPingPong`

- VRMA 第 0 帧是**绑定姿势**（A-pose / T-pose），不是动作起点
- `LoopRepeat` 会从末帧硬切到第 0 帧 → 视觉跳帧
- `LoopPingPong` 让末帧和第 0 帧之间是反向回放过渡，循环点肉眼无感

### 3. 为什么不用 `resolveResource`

Tauri 2 的 `resolveResource` 返回 `<exe-dir>/assets/...`，但 bundle 后资源在 `<exe-dir>/resources/assets/...`，**多了一层 `resources/`**。所以 `assetUrl.ts` 直接拼 `join(resourceDir(), "resources", url)`。

### 4. 为什么窗口锁定 3:4

- VRM 是直立角色，横向空间需求小、纵向大
- 锁 3:4 比例符合桌面宠物的"立牌"形态
- Rust 端 `WINDOW_ASPECT_W_OVER_H = 0.75` 和 JS 端 `resizeWindowToVRM` 用同一比例

### 5. 性能设计要点

- **fetch / parse / frameVRM 分阶段 + yield**：避免 WebView 冻屏
- **disposeVRM 延后到 setTimeout(0)**：避免 `deepDispose` 阻塞 100~500ms
- **loadToken / animToken**：并发请求自动过期，只保留最新
- **SWITCH_DEBOUNCE_MS=200**：模型切换防抖
- **clipCache**：同一 URL 的 VRMA 只解析一次
- **手写 wheel listener `{ passive: false }`**：svelte 编译的 onwheel 是 passive，preventDefault 不生效

## 🔧 十、已解决的问题

| 问题 | 解决 |
|------|------|
| 切换模型时旧模型 GPU 资源不释放 → 内存泄漏 | `disposeVRM` 延后 + `VRMUtils.deepDispose` |
| 40 MB 模型同步 parse 冻屏 1~3s | fetch / parse / frameVRM 三段 + yield |
| 用户连点模型下拉 → 多个 load 并行 | SWITCH_DEBOUNCE + loadToken 过期 |
| `resolveResource` 路径少一层 `resources/` | `assetUrl.ts` 手拼路径 |
| 模型取景对宽高比例敏感 | 用 `headY` / `feetY` 算人型高度 |
| VRMA 循环跳帧 | 改 `LoopPingPong` |
| 滚轮缩放窗口失效 | svelte passive listener + Tauri 缺 `allow-set-size` 权限 |
| `Mio.vrm` 330 MB 撞 GitHub 100 MB 限制 | 删除 + 整理仓库结构 |

## 🚧 十一、已知限制

- 动画速度：`LoopPingPong` 让动作看起来稍慢（未调 `setEffectiveTimeScale`）
- 浏览器 fallback：`assetUrl.ts` 在纯浏览器跑（`pnpm dev`）时不会加载模型（`main.ts` 不扫盘）
- 多动画 blend：未实现
- 无边框窗口：没自定义拖动区，靠长按 + 移动触发 OS 拖动
- 模型换装：未实现
- 表情控制 UI：未实现

## 📜 十二、版本演进

- **v0.1 — first commit**：纯 Web + three.js + Vue 3 的 VRM 查看器
- **v0.2**：迁移到 Tauri 2 + Vue 3 + three.js，本地资源加载
- **v0.3**：迁移到 Svelte 5 + runes
- **v0.4**：配置 Tauri 资源协议，资源从 `public/` 移到 `src-tauri/resources/`
- **v0.5**：重构 VRM 加载管线（fetch/parse 分阶段 + yield），加窗口比例约束
- **v0.6**：VRMA 循环改 `LoopPingPong`；整理仓库结构；文档重写
- **v0.7**：滚轮缩放窗口修复（passive listener + Tauri 权限）

## 🎯 十三、目标路线图

> 接下来要做的事。优先级高 → 低。

| 阶段 | 内容 |
|------|------|
| 1 | MCP Server 集成：选型 `rust-mcp-sdk` 或 `turbomcp`，实现 `send_thought_to_vibreak` 工具 |
| 2 | `MCPEvent` → 前端状态：Tauri command 把 MCP 事件转发到前端 `appState` |
| 3 | 表情控制 UI：把 VRM `expressionManager` 暴露给用户 |
| 4 | 多动画混合：`clipAction(A).weight` 平滑过渡 |
| 5 | 动画速度调节：UI slider → `setEffectiveTimeScale` |
| 6 | 摸鱼新闻弹幕：内置段子库 + UI 滚动文字 |
| 7 | 日志统计日报：解析 `~/.claude/history.jsonl` |
| 8 | AI 毒舌点评：OpenAI 兼容 API（DeepSeek / 通义千问） |
| 9 | 长期：替换 Tauri + WebView 为 Bevy + Rust MCP 单进程原生方案 |

## 🛡 十四、注意事项

### 📍 当前

- **启动**：`pnpm tauri dev`（不要用 `pnpm dev`，浏览器模式不加载模型）
- **添加资源**：直接丢到 `src-tauri/resources/assets/`，重启应用
- **Tauri 配置改动**：改 `tauri.conf.json` / `capabilities/default.json` 后**必须重启** dev server
- **版权**：第三方 VRM 模型注意授权协议（一般商用需作者许可）

### 🎯 目标阶段

- **启动顺序**：先启动 Vibe Break，再在 Claude Code 中加载 MCP 配置
- **文件权限**：需读取 `~/.claude/` 目录
- **降级方案**：`--no-game` 参数关闭 3D 窗口，退化为纯终端模式

## 🎮 十五、使用流程

### 📍 当前

```bash
# 1. 安装依赖
pnpm install

# 2. 启动
pnpm tauri dev

# 3. 打包
pnpm tauri build
# 产物在 src-tauri/target/release/bundle/
```

### 🎯 目标

1. 在 Claude Code 项目目录配置 MCP 指向 Vibe Break 可执行文件
2. 运行 `vibe-break` 启动 3D 窗口并等待 Claude Code 连接
3. 在另一终端正常使用 Claude Code，3D 窗口自动跟随 AI 状态切换动画