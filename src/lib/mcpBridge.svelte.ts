import { listen } from "@tauri-apps/api/event";
import { appState } from "$lib/stores.svelte";
import { emit, type McpEventPayload } from "$lib/eventBus.svelte";

export async function startMcpBridge(): Promise<() => void> {
  const unlisten = await listen<McpEventPayload>("mcp:event", (evt) => {
    const payload = evt.payload;
    if (!payload || typeof payload.type !== "string") return;

    const type = payload.type;

    emit("mcp:event", payload);

    switch (type) {
      case "thinking":
        appState.aiState = "thinking";
        if (!appState.thinkingStart) {
          appState.thinkingStart = Date.now();
          appState.thinkingPeriods.push({ start: appState.thinkingStart });
        }
        break;
      case "thinking:end":
        appState.aiState = "idle";
        if (appState.thinkingStart) {
          const last = appState.thinkingPeriods[appState.thinkingPeriods.length - 1];
          if (last && !last.end) last.end = Date.now();
          appState.thinkingStart = 0;
        }
        break;
      case "file.write":
        appState.counters.filesWritten++;
        break;
      case "command.exec":
        appState.counters.commandsRun++;
        break;
      case "error":
        appState.counters.errors++;
        appState.aiState = "error";
        appState.mcpUi.showErrorFeedback = true;
        const meta = payload.meta as Record<string, unknown> | undefined;
        appState.mcpUi.errorMsg = typeof meta?.message === "string" ? meta.message : "Unknown error";
        break;
      case "done":
        appState.aiState = "done";
        break;
      case "progress":
        break;
    }
  });

  return () => {
    unlisten();
  };
}
