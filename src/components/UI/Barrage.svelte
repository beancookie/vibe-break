<script lang="ts">
  import { onMount } from "svelte";
  import { appState } from "$lib/stores.svelte";
  import { seedDevData } from "$lib/devSeed";
  import BarrageItem from "./BarrageItem.svelte";

  const MAX_BARRAGE = 3;
  const TICK_MS = 5000;

  interface Item {
    id: number;
    text: string;
    link?: string;
  }

  let items: Item[] = $state([]);
  let nextId = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  function removeItem(id: number, text: string) {
    items = items.filter((i) => i.id !== id);
    clickedTexts.add(text);
    const i = appState.news.findIndex((n) => "[" + n.source + "] " + n.title === text);
    if (i !== -1) {
      appState.news.splice(i, 1);
      if (appState.news.length === 0) {
        appState.newsIndex = 0;
      } else if (i <= appState.newsIndex) {
        appState.newsIndex = Math.max(0, appState.newsIndex - 1);
      }
    }
  }

  onMount(() => {
    seedDevData();

    timer = setInterval(() => {
      if (appState.news.length > 0) {
        appState.newsIndex = (appState.newsIndex + 1) % appState.news.length;
      }
    }, TICK_MS);

    return () => {
      if (timer !== null) clearInterval(timer);
    };
  });

  let clickedTexts = new Set<string>();

  $effect(() => {
    const news = appState.news;
    const idx = appState.newsIndex;
    if (news.length === 0) return;
    const item = news[idx];
    if (!item) return;

    const text = "[" + item.source + "] " + item.title;
    if (clickedTexts.has(text)) return;
    if (items.length >= MAX_BARRAGE) return;
    if (items.length > 0 && items[items.length - 1].text === text) return;

    items = [...items, { id: nextId++, text, link: item.link }];
  });
</script>

{#each items as item (item.id)}
  <BarrageItem text={item.text} link={item.link} onclose={() => removeItem(item.id, item.text)} />
{/each}
