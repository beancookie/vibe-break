import { appState, pushNews } from "$lib/stores.svelte";

const SEED_NEWS: { title: string; source: string; link: string }[] = [
  { title: "离职被告知启动竞业协议了该怎么办", source: "掘金", link: "https://juejin.cn/post/7637856870833635343" },
  { title: "龙芯 CPU 的 Rust 使用体验", source: "V2EX", link: "https://v2ex.com/t/1223229#reply0" },
  { title: "2026 年前端工具链盘点：谁在崛起谁在衰落", source: "掘金", link: "https://juejin.cn" },
  { title: "GitHub Copilot 免费了，但你会用吗", source: "V2EX", link: "https://v2ex.com" },
  { title: "从单体到微服务，我们做错了什么", source: "知乎", link: "https://zhuanlan.zhihu.com" },
  { title: "Svelte 5 正式发布，跑起来比 Vue 还快", source: "掘金", link: "https://juejin.cn" },
  { title: "Tauri 2.0 跨平台桌面应用实战指南", source: "掘金", link: "https://juejin.cn" },
];

export function seedMockNews() {
  if (import.meta.env.VITE_SEED_NEWS !== "true") return;
  if (appState.news.length > 0) return;

  for (const item of SEED_NEWS) {
    pushNews(item);
  }
}

const ENCOURAGE_MESSAGES: string[] = [
  "写得不错，继续加油写得不错，继续加油写得不错，继续加油写得不错，继续加油 💪",
  "今天你也闪闪发光写得不错，继续加油写得不错，继续加油 ✨",
  "专注的姿势很迷人写得不错，继续加油写得不错，继续加油 🎯",
  "代码会记住你的努力 写得不错，继续加油写得不错，继续加油🚀",
  "休息是为了走更远的路写得不错，继续加油写得不错，继续加油 🌿",
];

const MOCK_INTERVAL_MS = 15_000;

let encourageTimer: ReturnType<typeof setInterval> | null = null;

export function seedMockEncourage() {
  if (import.meta.env.VITE_SEED_ENCOURAGE !== "true") return;
  if (encourageTimer !== null) return;
  encourageTimer = setInterval(() => {
    if (appState.mcpUi.encourageMessage) return;
    appState.mcpUi.encourageMessage =
      ENCOURAGE_MESSAGES[Math.floor(Math.random() * ENCOURAGE_MESSAGES.length)];
  }, MOCK_INTERVAL_MS);
}
