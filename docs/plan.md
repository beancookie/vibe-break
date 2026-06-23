# 🎮 Vibe Break — VRM Viewer (Web 架构)

将 3D 角色作为 Web 应用展示，使用 `three.js` + `@pixiv/three-vrm` 在浏览器中加载和显示 VRM 模型。

> **注**：早期版本是 Rust + Bevy 的单文件原生桌面程序。考虑到 `bevy_vrm` 对 VRM 0.x 材质（MToon 透明 / Alpha Blend）渲染存在已知问题（眼睛被误剔除），整个前端栈迁移到 Web 端，使用 VRM 社区标准加载器 `@pixiv/three-vrm`，对 VRM 0.x / 1.x 都有成熟的 MToon 着色实现。

## 📌 一、项目概述

Vibe Break 是一个**浏览器内运行的 VRM 角色查看器**，将等待 AI 生成代码、编译、部署等碎片时间的视觉娱乐反馈交给 Web 端处理。

- **轻量** — 双击 `index.html`（或运行 `npm run dev`）即可使用
- **跨平台** — 任何现代浏览器（Chrome / Edge / Firefox / Safari）
- **零运行时依赖** — 用户只需浏览器，无需安装额外软件

## 🎯 二、核心功能（当前阶段）

| 功能 | 说明 |
|------|------|
| VRM 加载 | 支持 VRM 0.0 和 1.0（自动检测） |
| OrbitControls | 鼠标拖动旋转、滚轮缩放 |
| MToon 着色 | 正确处理 VRM 0.x 的 MToon 材质（包括透明的眼睛、睫毛等）|
| 切换模型 | 通过下拉菜单切换不同 VRM 文件 |

> ⚠️ **未实现（未来扩展）**：实时状态可视化、摸鱼新闻弹幕、AI 毒舌点评。这些需要后端服务（MCP server、日志读取、AI API 调用）配合。

## 🧩 三、技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| 语言 | TypeScript | 类型安全，与 three.js 生态一致 |
| 构建工具 | Vite 5 | 极快 HMR，零配置 TS，ESM 原生 |
| 3D 引擎 | three.js (~0.169) | 业界标准 VRM 容器 |
| VRM 加载器 | @pixiv/three-vrm 2.x | VRM 官方维护，支持 0.x 和 1.x，MToon 着色完整 |
| 控制器 | three.js OrbitControls | 相机轨道控制，three.js 内置 |

## 🔄 四、系统架构

```
┌─────────────────────────────────────┐
│        Browser (Vite dev/build)     │
│  ┌──────────────┐  ┌────────────┐   │
│  │  three.js    │  │ three-vrm  │   │
│  │  WebGL2      │◄─┤  loader    │   │
│  │  renderer    │  │  (MToon)   │   │
│  └──────────────┘  └────────────┘   │
│         ▲                           │
│         │ GLTFLoader + VRMLoaderPlugin│
│         ▼                           │
│  ┌──────────────────────────┐       │
│  │  assets/*.vrm (静态资源)  │       │
│  └──────────────────────────┘       │
└─────────────────────────────────────┘
```

**Vite 构建产物**：
- `dist/index.html` — 入口
- `dist/assets/*.{js,css}` — 编译后的代码
- `dist/assets/*.vrm` — VRM 文件（Vite 默认会把 `assets/` 下的文件原样拷贝到 `dist/assets/`）

## 📂 五、目录结构

```
/
├── index.html                  # Vite 入口
├── package.json                # 依赖与脚本
├── tsconfig.json               # TS 严格模式
├── vite.config.ts              # Vite 配置（base="./"）
├── .gitignore
├── README.md
├── docs/
│   └── plan.md
├── assets/                     # VRM 模型
│   ├── 芙宁娜.vrm
│   └── Klee.vrm
└── src/
    ├── main.ts                 # 场景、相机、灯光、动画循环
    ├── vrm.ts                  # VRM 加载 / 释放工具
    └── styles.css              # 暗色背景 + 顶部 UI
```

## 🔌 六、运行方式

```bash
# 1. 安装依赖（首次）
npm install

# 2. 开发模式（HMR）
npm run dev
# 浏览器打开 http://localhost:5173

# 3. 生产构建
npm run build
# 产物在 dist/

# 4. 预览生产构建
npm run preview
```

## 🎨 七、关键实现

**`src/vrm.ts`** — VRM 加载：
- 用 `GLTFLoader` 加载 glTF
- 注册 `VRMLoaderPlugin` 自动检测 VRM 0.0 / 1.0
- 用 `VRMUtils.rotateVRM0(vrm)` 校正朝向
- 用 `VRMUtils.deepDispose` 释放 GPU 资源

**`src/main.ts`** — 场景搭建：
- WebGLRenderer + sRGB output + ACES tone mapping
- 主光 (DirectionalLight, 1.0) + 补光 (0.4) + 环境光 (0.5)
- OrbitControls，目标点 (0, 1.2, 0)
- 切换模型时 `disposeVRM(old)` 再 `scene.add(new)`

## 🛡 八、注意事项

- **VRM 0.x 转换 VRM 1.0** — 社区主要工具：UniVRM 0.108+ 自带的转换器，或在线转换工具。本项目支持两种版本，无需转换。
- **版权** — 第三方 VRM 模型注意授权协议（一般商用需作者许可）。
- **浏览器要求** — 需要支持 WebGL2（Chrome 56+ / Firefox 51+ / Edge 79+ / Safari 15+）。

## 🔮 九、后续扩展（未实现）

| 方向 | 说明 |
|------|------|
| 实时状态可视化 | 通过 WebSocket / SSE 接收 Claude Code 状态事件，驱动模型动画 |
| 表情/动作控制 | 切换 VRM 表情，播放 VRMA 动画 |
| MCP 集成 | 若需 stdio MCP，需 Node sidecar 或 Rust 进程间通信 |

> 这些扩展需要后端服务支撑，超出"Web 端 VRM 查看器"的范围。
