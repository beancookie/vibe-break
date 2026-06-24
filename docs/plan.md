# 🎮 Vibe Break — 开发规划

## 📌 一、项目定位

Vibe Break 是一个**桌面端的 VRM 角色查看器 + 动画播放器**。把等代码、编译、部署的碎片时间，交给一个可爱的桌面宠物陪你度过。

**当前阶段**：可用的桌面应用，支持加载多个 VRM 模型、播放 VRMA 动画、自动取景、自适应窗口。

---

## 🏗 二、当前架构

### 技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 桌面壳 | Tauri 2 | Rust 后端 + WebView 前端 |
| 前端框架 | Svelte 5（runes） | 状态/响应式 |
| 场景封装 | Threlte | Svelte 适配的 three.js 声明式 API |
| 3D 引擎 | three.js | 渲染 |
| VRM | @pixiv/three-vrm | VRM 0.x / 1.x，MToon 着色 |
| 动画 | @pixiv/three-vrm-animation | VRMA 解析 |
| 样式 | Tailwind CSS v4 | UI 样式 |

### 资源加载管线

```
┌──────────────────────────────────────────────────────────────┐
│  启动                                                        │
│                                                              │
│  1. main.ts: 调 invoke("list_assets")  →  拿到 vrm/vrma 列表  │
│                                                              │
│  2. 用户选模型 → debounce 200ms → startLoad(idx)              │
│       ├─ fetch buffer（asset:// 协议，Tauri IO 线程）         │
│       ├─ yield → parse（GLTFLoader + VRMLoaderPlugin）        │
│       ├─ yield → frameVRM（自动取景）+ resizeWindowToVRM     │
│       └─ 切场景：scene.remove(old) + scene.add(new)           │
│                                                              │
│  3. 用户选动画 → $effect 重新跑 → mixer.clipAction（loop）    │
│                                                              │
│  4. 每帧：useTask → vrm.update(dt) + mixer.update(dt)        │
└──────────────────────────────────────────────────────────────┘
```

### 关键文件

| 文件 | 职责 |
|------|------|
| `src-tauri/src/lib.rs` | `list_assets` 命令、窗口比例约束、IO 线程扫描 |
| `src-tauri/tauri.conf.json` | assetProtocol scope、bundle.resources 列表 |
| `src/lib/three/assetUrl.ts` | `asset://` URL 构造 |
| `src/lib/three/useVrm.ts` | `loadVRM` / `loadVRMAClip` / `disposeVRM` |
| `src/lib/three/loadAssets.ts` | 调 `invoke("list_assets")` |
| `src/lib/stores.svelte.ts` | `appState` 全局状态 |
| `src/components/Scene/VrmModel.svelte` | 模型加载 + 动画播放 + 自动取景 + 窗口尺寸 |
| `src/components/UI/VrmContextMenu.svelte` | 上下文菜单 UI |

### 性能设计要点

- **fetch 与 parse 分阶段 + yield**：WebView 不会冻屏
- **disposeVRM 延后到 setTimeout(0)**：避免同步 `deepDispose` 阻塞 100~500ms
- **loadToken / animToken**：并发的加载/动画请求自动过期，只保留最新
- **SWITCH_DEBOUNCE_MS=200**：模型切换防抖
- **clipCache**：同一 URL 的 VRMA clip 只解析一次
- **LoopPingPong**：VRMA 循环改用 ping-pong，消除第 0 帧绑定姿势带来的跳帧

---

## 🧠 三、关键技术决策与原因

### 1. 为什么走 Tauri 2 而不是 Electron / 纯 Web

- **包体积**：Tauri 2 安装包约 5~10 MB，Electron 经常 100+ MB
- **资源访问**：Rust 端直接扫描本地 `resources/assets/`，无需手动打包
- **跨平台**：同一份代码 Windows / macOS / Linux
- **WebView 共享 Chromium 内核**：three.js / WebGL2 兼容性有保障

### 2. 为什么用 Threlte 而不是裸 three.js

- **声明式**：Svelte 组件树和 scene graph 一一对应
- **生命周期托管**：`useTask` 自动清理，不用手写 requestAnimationFrame
- **响应式相机/控制器**：`useThrelte()` 直接拿到 scene / camera

### 3. 为什么 VRMA 循环用 ping-pong

- VRMA 文件的第 0 帧是**绑定姿势**（A-pose / T-pose），不是动作起点
- 用 `LoopRepeat` 时，每轮循环会从末帧**硬切**到第 0 帧 → 视觉跳帧
- 改用 `LoopPingPong` 后，末帧和第 0 帧之间是**反向回放过渡**，循环点肉眼无感
- 副作用：动作速度感略降（可后续用 `setEffectiveTimeScale` 调速）

### 4. 为什么不用 `resolveResource`

Tauri 2 的 `resolveResource("assets/...")` 返回 `<exe-dir>/assets/...`，但 bundle 后资源实际在 `<exe-dir>/resources/assets/...`，**多了一层 `resources/`**。所以 `assetUrl.ts` 直接拼 `join(resourceDir(), "resources", url)`。

### 5. 为什么窗口锁定 3:4

- VRM 模型是直立角色，横向空间需求小、纵向空间需求大
- 锁 3:4 (W:H) 比例既符合桌面宠物的"立牌"形态，又和模型取景算法一致（Rust 端 `WINDOW_ASPECT_W_OVER_H` 和 JS 端 `resizeWindowToVRM` 都按此比例算）

---

## 🔧 四、已解决的问题 / 踩过的坑

| 问题 | 解决 |
|------|------|
| 切换模型时旧模型 GPU 资源不释放 → 内存泄漏 | `disposeVRM` 延后 + `VRMUtils.deepDispose` |
| 40 MB 模型同步 parse 冻屏 1~3s | fetch / parse / frameVRM 三段 + yield |
| 用户连点模型下拉 → 多个 load 并行 | SWITCH_DEBOUNCE + loadToken 过期 |
| `resolveResource` 路径少一层 `resources/` | `assetUrl.ts` 手拼路径 |
| 模型取景对宽高比例敏感 | 用 `headY` / `feetY` 算人型高度，统一从人型顶部取景 |
| VRMA 循环跳帧 | 改 `LoopPingPong` |
| `Mio.vrm` 330 MB 撞 GitHub 100 MB 限制 | 删除文件 + 重新整理仓库结构 |

---

## 🚧 五、已知限制

- **动画速度**：`LoopPingPong` 让动作看起来稍慢（目前未调 `setEffectiveTimeScale`）
- **资源路径**：`assetUrl.ts` 的浏览器 fallback 走 `public/`，但 `main.ts` 在非 Tauri 模式下不扫盘，纯浏览器跑也看不到模型
- **多模型 blend**：当前不支持 VRMA + 表情混合（blendShape 权重还没接到 UI）
- **无边框窗口**：`decorations: false` 关掉了标题栏，目前没有自定义拖动区

---

## 🔮 六、未来扩展（未实现）

| 方向 | 说明 | 优先级 |
|------|------|--------|
| 表情控制 UI | 把 VRM 的 `expressionManager` 表情列出来，让用户手动调 | 中 |
| 多动画混合 | `mixer.clipAction(A).weight=0.5 + B.weight=0.5` 平滑过渡 | 中 |
| 动画速度调节 | UI slider → `action.setEffectiveTimeScale(v)` | 低 |
| MCP 集成 | 通过 Tauri 的 sidecar / stdio MCP 接收 Claude Code 状态，自动播对应动画 | 高（项目初心） |
| 自定义拖动区 | 加一个顶栏，允许无边框窗口拖动 | 中 |
| 资源热重载 | 监听 `resources/assets/` 变化，自动重新扫描 | 低 |
| 主题/换装 | 加载多套贴图 / 切换服装 | 低 |

---

## 📜 七、版本演进

- **v0.1 — first commit**: 纯 Web + three.js + Vue 3 的 VRM 查看器
- **v0.2**: 迁移到 Tauri 2 + Vue 3 + three.js，实现本地资源加载
- **v0.3**: 迁移到 Svelte 5 + runes
- **v0.4**: 配置 Tauri 资源协议，资源从 `public/` 移到 `src-tauri/resources/`
- **v0.5**: 重构 VRM 加载管线（fetch/parse 分阶段 + yield），加窗口比例约束
- **v0.6 (当前)**: VRMA 循环改 `LoopPingPong` 消除跳帧；整理仓库结构（删 `public/assets/`、去掉误加的 .gitignore 规则、补齐资源 commit）
