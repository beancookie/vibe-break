import { listen } from "@tauri-apps/api/event";
import { appState } from "$lib/stores.svelte";
import { emit, type McpEventPayload, type ActionCommand } from "$lib/eventBus.svelte";
import { logger } from "$lib/logger";

function handleActions(actions: ActionCommand[]) {
  for (const action of actions) {
    switch (action.type) {
      case "play_anim":
        if (action.url) {
          appState.selectedAnim = action.url;
        } else if (action.name) {
          const match = appState.animList.find((a) => a.name === action.name);
          if (match) appState.selectedAnim = match.url;
        }
        break;
      case "expression":
        appState.pendingExpression = { name: action.name ?? "", weight: action.weight ?? 1.0 };
        break;
      case "bone_pose":
        appState.pendingBonePose = {
          bone: action.bone ?? "",
          x: action.x ?? 0,
          y: action.y ?? 0,
          z: action.z ?? 0,
        };
        break;
    }
  }
}

export async function startMcpBridge(): Promise<() => void> {
  const unlisten = await listen<McpEventPayload>("mcp:event", (evt) => {
    const payload = evt.payload;
    if (!payload || typeof payload.type !== "string") return;

    const type = payload.type;

    logger.info("[MCP]", "event received", { type: payload.type, actions: payload.actions });
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
      case "trigger:write":
        appState.counters.filesWritten++;
        break;
      case "trigger:exec":
        appState.counters.commandsRun++;
        break;
      case "system:error":
        appState.counters.errors++;
        appState.aiState = "error";
        appState.mcpUi.showErrorFeedback = true;
        const meta = payload.meta as Record<string, unknown> | undefined;
        appState.mcpUi.errorMsg = typeof meta?.message === "string" ? meta.message : "Unknown error";
        break;
      case "system:done":
        appState.aiState = "done";
        break;
      case "system:progress":
        break;
    }

    if (payload.actions && payload.actions.length > 0) {
      handleActions(payload.actions);
    }
  });

  return () => {
    unlisten();
  };
}
