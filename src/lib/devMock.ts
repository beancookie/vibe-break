import { appState, pushNews } from "$lib/stores.svelte";

const SEED_NEWS: { title: string; source: string; link: string }[] = [
  { title: "离职被告知启动竞业协议了该怎么办", source: "掘金", link: "https://juejin.cn/post/7637856870833635343" },
  { title: "龙芯 CPU 的 Rust 使用体验", source: "V2EX", link: "https://v2ex.com/t/1223229#reply0" },
];

const ENCOURAGE_MESSAGES: string[] = [
  "写得不错，继续加油 💪",
  "今天你也闪闪发光 ✨",
  "专注的姿势很迷人 🎯",
  "代码会记住你的努力 🚀",
  "休息是为了走更远的路 🌿",
];

export function seedDevData() {
  if (!import.meta.env.VITE_SEED_NEWS) return;
  if (appState.news.length > 0) return;

  for (const item of SEED_NEWS) {
    pushNews(item);
  }

  if (!import.meta.env.VITE_SEED_ENCOURAGE) return;
  if (appState.mcpUi.encourageMessage) return;

  appState.mcpUi.encourageMessage =
    ENCOURAGE_MESSAGES[Math.floor(Math.random() * ENCOURAGE_MESSAGES.length)];
}
