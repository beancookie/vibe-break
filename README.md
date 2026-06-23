# Vibe Break

一个基于 **Tauri 2 + Svelte 5 + three.js** 的桌面应用,用于加载并展示 **VRM** 3D 模型与 **VRMA** 动画。

## ✨ 特性

- 🧊 通过 `three.js` 渲染 VRM 3D 角色
- 🎭 支持加载多个 VRM 模型(默认包含「芙宁娜」「Klee」)
- 🕺 内置多个 VRMA 动画(Angry / Blush / Clapping / Goodbye / Jump / LookAround / Relax / Sad 等)
- 🎥 OrbitControls 轨道相机控制
- 🪟 跨平台桌面端打包(Tauri 2)

## 🧰 技术栈

- **前端**: Svelte 5(runes) + TypeScript + Vite
- **3D 渲染**: three.js + [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) + [@pixiv/three-vrm-animation](https://github.com/pixiv/three-vrm-animation)
- **桌面壳**: Tauri 2(Rust)
- **资源协议**: `tauri` 的 `protocol-asset`,允许通过 `convertFileSrc` 加载本地资源

## 📁 项目结构

```
vibe-break/
├── src/                      # Svelte 前端源码
│   ├── components/
│   │   └── VrmViewer.svelte  # VRM 查看器组件
│   ├── main.ts
│   └── vite-env.d.ts
├── src-tauri/                # Tauri Rust 后端
│   ├── src/                  # Rust 源码
│   ├── resources/            # 打包资源(VRM/VRMA)
│   │   └── assets/
│   │       ├── *.vrm
│   │       └── vrma/*.vrma
│   ├── capabilities/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── public/                   # 静态资源
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18
- **pnpm** >= 8(推荐)
- **Rust** 工具链([安装](https://rustup.rs/))
- Tauri 2 系统依赖,参见 [Tauri 官方文档](https://tauri.app/start/prerequisites/)

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm tauri dev
```

启动后会自动运行 Vite 开发服务器(`http://localhost:1420`)并打开 Tauri 窗口。

### 构建发布版

```bash
pnpm tauri build
```

产物会输出到 `src-tauri/target/release/bundle/`。

## 🎨 添加模型 / 动画

1. 将 `.vrm` 文件放入 `src-tauri/resources/assets/`
2. 将 `.vrma` 文件放入 `src-tauri/resources/assets/vrma/`
3. 在 `src/components/VrmViewer.svelte` 中将路径追加到 `VRMS` / `ANIMATIONS` 数组:

```ts
const VRMS = [
  { name: "芙宁娜", url: "assets/芙宁娜.vrm" },
  { name: "MyModel", url: "assets/MyModel.vrm" }, // 新增
];

const ANIMATIONS = [
  { name: "Angry", url: "assets/vrma/Angry.vrma" },
  { name: "MyAnim", url: "assets/vrma/MyAnim.vrma" }, // 新增
];
```

资源通过 Tauri 的 `asset://` 协议加载(`tauri.conf.json` 中已开启 `assetProtocol` 并将 `$RESOURCE/**` 加入 scope)。

## 📜 可用脚本

| 命令               | 说明                |
| ------------------ | ------------------- |
| `pnpm dev`         | 启动 Vite 开发服务器 |
| `pnpm build`       | `svelte-check` 类型检查并构建前端 |
| `pnpm check`       | 仅运行类型检查       |
| `pnpm preview`     | 预览构建产物         |
| `pnpm tauri dev`   | 启动 Tauri 开发模式  |
| `pnpm tauri build` | 打包桌面应用         |

## 📦 模型 / 动画来源

- [VRM 格式规范](https://vrm.dev/)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- VRMA 示例动画由 [VRM Consortium](https://github.com/vrm-c) 提供

## 📄 License

MIT
