<script lang="ts">
  import { onMount } from "svelte";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { appState, recycleNews, MAX_NEWS } from "$lib/stores.svelte";
  import { seedMockNews, seedMockEncourage } from "$lib/devMock";
  import BarrageItem from "./BarrageItem.svelte";

  const MAX_BARRAGE = 20;
  const TRACK_COUNT = 10;

  let idCounter = 0;
  let blocked = $state(new Set<string>());
  let activeTracks = $state(new Set<number>());

  async function blockItem(text: string, link: string | undefined) {
    if (link && isTauri()) {
      await openUrl(link);
    }
    blocked.add(text);
    if (blocked.size > MAX_NEWS) {
      const first = blocked.values().next().value;
      if (first) blocked.delete(first);
    }
    removeItem(text, link);
    const match = text.match(/^\[(.+?)\]\s(.+)$/);
    if (match && isTauri()) {
      invoke("block_news", { source: match[1], title: match[2] }).catch((e) =>
        console.error("[Barrage] block_news failed:", e)
      );
    }
  }

  interface Item {
    id: number;
    text: string;
    link?: string;
    track: number;
  }

  let items: Item[] = $state([]);

  function removeItem(text: string, link: string | undefined) {
    const removed = items.find((i) => i.text === text);
    if (removed) activeTracks.delete(removed.track);
    items = items.filter((i) => i.text !== text);
    if (!blocked.has(text)) {
      recycleNews(text, link);
    }
    fillSlots();
  }

  function pickTrack(): number {
    if (activeTracks.size < TRACK_COUNT) {
      for (let t = 0; t < TRACK_COUNT; t++) {
        if (!activeTracks.has(t)) return t;
      }
    }
    return Math.floor(Math.random() * TRACK_COUNT);
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
      const track = pickTrack();
      if (activeTracks.size < TRACK_COUNT) activeTracks.add(track);
      items = [...items, { id: ++idCounter, text, link: first.link ?? "", track }];
      appState.news = appState.news.slice(1);
    }
  }

  onMount(() => {
    seedMockNews();
    seedMockEncourage();
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
    track={item.track}
    onexpired={(text) => removeItem(text, item.link)}
    onblock={(text) => blockItem(text, item.link)}
  />
{/each}
