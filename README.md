# Vibe Break

一个基于 **Tauri 2 + Svelte 5 + three.js** 的桌面应用，用于加载并展示 **VRM** 3D 模型与 **VRMA** 动画。

> 把等代码、编译、部署的碎片时间，交给一个可爱的桌面宠物陪你度过。

## 🎬 演示

![Demo](./docs/demo.gif)

## ✨ 特性

- 🎏 通过 `three.js` 渲染 VRM 3D 角色
- 🎭 支持加载多个 VRM 模型（默认附带 芙宁娜、刻晴、八重神子、甘雨、Klee）
- 🕺 内置多个 VRMA 动画（Angry / Blush / Clapping / Goodbye / Jump / LookAround / Relax / Sad / Sleepy / Surprised / Thinking）
- 🧭 鼠标拖拽旋转、滚轮缩放（OrbitControls）
- 📐 模型自动取景，窗口按 3:4 比例自适应大小
- 🪟 跨平台桌面端打包（Tauri 2：Windows / macOS / Linux）
- 🔁 VRMA 动画 `LoopPingPong` 循环播放，消除跳帧

## 🛠 技术栈

- **前端**: Svelte 5（runes）+ TypeScript + Vite
- **3D 渲染**: three.js + [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) + [@pixiv/three-vrm-animation](https://github.com/pixiv/three-vrm-animation)
- **场景框架**: [Threlte](https://threlte.xyz/)（Svelte 适配的 three.js 声明式封装）
- **桌面壳**: Tauri 2（Rust）
- **资源协议**: `tauri` 的 `protocol-asset`，通过 `convertFileSrc` 加载本地资源

## 📦 项目结构

```
vibe-break/
├── src/                          # Svelte 前端源码
│   ├── components/
│   │   ├── Scene/                # 3D 场景相关组件
│   │   ├── UI/                   # 上下文菜单等 UI
│   │   └── VrmViewer.svelte      # 顶层组件
│   ├── lib/
│   │   ├── three/                # useVrm / assetUrl / loadAssets
│   │   └── stores.svelte.ts      # 全局 appState
│   ├── app.css                   # Tailwind 入口
│   └── main.ts
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/
│   │   └── lib.rs                # list_assets 命令 + 窗口约束
│   ├── resources/                # 打包资源（VRM/VRMA）
│   │   └── assets/
│   │       ├── *.vrm
│   │       └── vrma/*.vrma
│   ├── capabilities/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── public/                       # 静态资源（只剩图标）
├── index.html
├── package.json
└── vite.config.ts
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

启动后会自动运行 Vite 开发服务器（`http://localhost:1420`）并打开 Tauri 窗口。

### 构建发布

```bash
pnpm tauri build
```

产物输出到 `src-tauri/target/release/bundle/`。

## 🎨 添加模型 / 动画

模型和动画在应用启动时由 Rust 端自动扫描，**无需改前端代码**：

1. 将 `.vrm` 文件放入 `src-tauri/resources/assets/`
2. 将 `.vrma` 文件放入 `src-tauri/resources/assets/vrma/`
3. 重启应用（`pnpm tauri dev` 或重新构建）

资源通过 Tauri 的 `asset://` 协议加载（`tauri.conf.json` 中已开启 `assetProtocol` 并将 `$RESOURCE/**` 加入 scope）。

**实现细节**：Rust 端的 `list_assets` 命令（`src-tauri/src/lib.rs`）扫描 `$RESOURCE/assets/`，把文件名作为展示名、相对路径作为 URL 返回给前端；前端在 `main.ts` 启动时调一次，把结果存到 `appState.vrmList` / `appState.animList`，UI 和加载逻辑直接订阅。

## 📜 可用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Vite 开发服务器（纯浏览器，不会加载模型） |
| `pnpm build` | `svelte-check` 类型检查并构建前端 |
| `pnpm check` | 仅运行类型检查 |
| `pnpm preview` | 预览构建产物 |
| `pnpm tauri dev` | 启动 Tauri 开发模式 |
| `pnpm tauri build` | 打包桌面应用 |

## 🌐 模型 / 动画来源

- [VRM 格式规范](https://vrm.dev/)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- VRMA 示例动画由 [VRM Consortium](https://github.com/vrm-c) 提供

## 📄 License

MIT
