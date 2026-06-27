<script lang="ts">
  import { onMount } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { appState, recycleNews, MAX_NEWS } from "$lib/stores.svelte";
  import { seedDevData } from "$lib/devSeed";
  import BarrageItem from "./BarrageItem.svelte";

  const MAX_BARRAGE = 3;

  let idCounter = 0;
  let blocked = $state(new Set<string>());

  async function blockItem(text: string, link: string) {
    if (link && isTauri()) {
      await openUrl(link);
    }
    blocked.add(text);
    if (blocked.size > MAX_NEWS) {
      const first = blocked.values().next().value;
      if (first) blocked.delete(first);
    }
    removeItem(text);
  }

  interface Item {
    id: number;
    text: string;
    link: string;
  }

  let items: Item[] = $state([]);

  function removeItem(text: string) {
    items = items.filter((i) => i.text !== text);
    if (!blocked.has(text)) {
      recycleNews(text);
    }
    fillSlots();
  }

  function fillSlots() {
    while (items.length < MAX_BARRAGE && appState.news.length > 0) {
      const first = appState.news[0];
      if (!first) break;
      const text = "[" + first.source + "] " + first.title;
      if (blocked.has(text)) {
        appState.news = appState.news.slice(1);
        continue;
      }
      if (items.some((i) => i.text === text)) break;
      items = [...items, { id: ++idCounter, text, link: first.link }];
      appState.news = appState.news.slice(1);
    }
  }

  onMount(() => {
    seedDevData();
  });

  $effect(() => {
    appState.news;
    items;
    fillSlots();
  });
</script>

{#each items as item (item.id)}
  <BarrageItem
    text={item.text}
    link={item.link}
    onexpired={(text) => removeItem(text)}
    onblock={(text) => blockItem(text, item.link)}
  />
{/each}
