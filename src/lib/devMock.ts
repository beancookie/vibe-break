import { appState, pushNews } from "$lib/stores.svelte";

const SEED_NEWS: { title: string; source: string; link: string }[] = [
  { title: "离职被告知启动竞业协议了该怎么办", source: "掘金", link: "https://juejin.cn/post/7637856870833635343" },
  { title: "龙芯 CPU 的 Rust 使用体验", source: "V2EX", link: "https://v2ex.com/t/1223229#reply0" },
];

export function seedDevData() {
  if (!import.meta.env.VITE_SEED_NEWS) return;
  if (appState.news.length > 0) return;

  for (const item of SEED_NEWS) {
    pushNews(item);
  }
}
