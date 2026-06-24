# Vibe Break
MIT

## 🎨 添加模型 / 动画

模型和动画在应用启动时由 Rust 端自动扫描,无需改前端代码:

1. 将 `.vrm` 文件放入 `src-tauri/resources/assets/`
2. 将 `.vrma` 文件放入 `src-tauri/resources/assets/vrma/`
3. 重启应用(`pnpm tauri dev` 或重新构建)

资源通过 Tauri 的 `asset://` 协议加载(`tauri.conf.json` 中已开启 `assetProtocol` 并将 `$RESOURCE/**` 加入 scope)。

实现细节:Rust 端的 `list_assets` 命令(`src-tauri/src/lib.rs`)扫描 `$RESOURCE/assets/`,把文件名作为展示名、相对路径作为 URL 返回给前端;前端在 `main.ts` 启动时调一次,把结果存到 `appState.vrmList` / `appState.animList`,UI 和加载逻辑直接订阅。


MIT
# Vibe Break

涓€涓熀浜?**Tauri 2 + Svelte 5 + three.js** 鐨勬闈㈠簲鐢?鐢ㄤ簬鍔犺浇骞跺睍绀?**VRM** 3D 妯″瀷涓?**VRMA** 鍔ㄧ敾銆?

## 鉁?鐗规€?

- 馃 閫氳繃 `three.js` 娓叉煋 VRM 3D 瑙掕壊
- 馃幁 鏀寔鍔犺浇澶氫釜 VRM 妯″瀷(榛樿鍖呭惈銆岃姍瀹佸銆嶃€孠lee銆?
- 馃暫 鍐呯疆澶氫釜 VRMA 鍔ㄧ敾(Angry / Blush / Clapping / Goodbye / Jump / LookAround / Relax / Sad 绛?
- 馃帴 OrbitControls 杞ㄩ亾鐩告満鎺у埗
- 馃獰 璺ㄥ钩鍙版闈㈢鎵撳寘(Tauri 2)

## 馃О 鎶€鏈爤

- **鍓嶇**: Svelte 5(runes) + TypeScript + Vite
- **3D 娓叉煋**: three.js + [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) + [@pixiv/three-vrm-animation](https://github.com/pixiv/three-vrm-animation)
- **妗岄潰澹?*: Tauri 2(Rust)
- **璧勬簮鍗忚**: `tauri` 鐨?`protocol-asset`,鍏佽閫氳繃 `convertFileSrc` 鍔犺浇鏈湴璧勬簮

## 馃搧 椤圭洰缁撴瀯

```
vibe-break/
鈹溾攢鈹€ src/                      # Svelte 鍓嶇婧愮爜
鈹?  鈹溾攢鈹€ components/
鈹?  鈹?  鈹斺攢鈹€ VrmViewer.svelte  # VRM 鏌ョ湅鍣ㄧ粍浠?
鈹?  鈹溾攢鈹€ main.ts
鈹?  鈹斺攢鈹€ vite-env.d.ts
鈹溾攢鈹€ src-tauri/                # Tauri Rust 鍚庣
鈹?  鈹溾攢鈹€ src/                  # Rust 婧愮爜
鈹?  鈹溾攢鈹€ resources/            # 鎵撳寘璧勬簮(VRM/VRMA)
鈹?  鈹?  鈹斺攢鈹€ assets/
鈹?  鈹?      鈹溾攢鈹€ *.vrm
鈹?  鈹?      鈹斺攢鈹€ vrma/*.vrma
鈹?  鈹溾攢鈹€ capabilities/
鈹?  鈹溾攢鈹€ Cargo.toml
鈹?  鈹斺攢鈹€ tauri.conf.json
鈹溾攢鈹€ public/                   # 闈欐€佽祫婧?
鈹溾攢鈹€ index.html
鈹溾攢鈹€ package.json
鈹溾攢鈹€ vite.config.ts
鈹斺攢鈹€ tsconfig.json
```

## 馃殌 蹇€熷紑濮?

### 鐜瑕佹眰

- **Node.js** 鈮?18
- **pnpm** >= 8(鎺ㄨ崘)
- **Rust** 宸ュ叿閾?[瀹夎](https://rustup.rs/))
- Tauri 2 绯荤粺渚濊禆,鍙傝 [Tauri 瀹樻柟鏂囨。](https://tauri.app/start/prerequisites/)

### 瀹夎渚濊禆

```bash
pnpm install
```

### 寮€鍙戞ā寮?

```bash
pnpm tauri dev
```

鍚姩鍚庝細鑷姩杩愯 Vite 寮€鍙戞湇鍔″櫒(`http://localhost:1420`)骞舵墦寮€ Tauri 绐楀彛銆?

### 鏋勫缓鍙戝竷鐗?

```bash
pnpm tauri build
```

浜х墿浼氳緭鍑哄埌 `src-tauri/target/release/bundle/`銆?

## 馃帹 娣诲姞妯″瀷 / 鍔ㄧ敾

1. 灏?`.vrm` 鏂囦欢鏀惧叆 `src-tauri/resources/assets/`
2. 灏?`.vrma` 鏂囦欢鏀惧叆 `src-tauri/resources/assets/vrma/`
3. 鍦?`src/components/VrmViewer.svelte` 涓皢璺緞杩藉姞鍒?`VRMS` / `ANIMATIONS` 鏁扮粍:

```ts
const VRMS = [
  { name: "鑺欏畞濞?, url: "assets/鑺欏畞濞?vrm" },
  { name: "MyModel", url: "assets/MyModel.vrm" }, // 鏂板
];

const ANIMATIONS = [
  { name: "Angry", url: "assets/vrma/Angry.vrma" },
  { name: "MyAnim", url: "assets/vrma/MyAnim.vrma" }, // 鏂板
];
```

璧勬簮閫氳繃 Tauri 鐨?`asset://` 鍗忚鍔犺浇(`tauri.conf.json` 涓凡寮€鍚?`assetProtocol` 骞跺皢 `$RESOURCE/**` 鍔犲叆 scope)銆?

## 馃摐 鍙敤鑴氭湰

| 鍛戒护               | 璇存槑                |
| ------------------ | ------------------- |
| `pnpm dev`         | 鍚姩 Vite 寮€鍙戞湇鍔″櫒 |
| `pnpm build`       | `svelte-check` 绫诲瀷妫€鏌ュ苟鏋勫缓鍓嶇 |
| `pnpm check`       | 浠呰繍琛岀被鍨嬫鏌?      |
| `pnpm preview`     | 棰勮鏋勫缓浜х墿         |
| `pnpm tauri dev`   | 鍚姩 Tauri 寮€鍙戞ā寮? |
| `pnpm tauri build` | 鎵撳寘妗岄潰搴旂敤         |

## 馃摝 妯″瀷 / 鍔ㄧ敾鏉ユ簮

- [VRM 鏍煎紡瑙勮寖](https://vrm.dev/)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- VRMA 绀轰緥鍔ㄧ敾鐢?[VRM Consortium](https://github.com/vrm-c) 鎻愪緵

## 馃搫 License

MIT
