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
| `pnpm format` | 自动格式化代码 |
| `pnpm format:check` | 检查代码格式 |
| `pnpm preview` | 预览构建产物 |
| `pnpm clean` | 清理构建产物 |
| `pnpm tauri:dev` | 同步资源再启动 Tauri 开发模式（**推荐**） |
| `pnpm tauri dev` | 直接启动 Tauri 开发模式（不自动同步资源） |
| `pnpm tauri build` | 打包桌面应用 |

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
