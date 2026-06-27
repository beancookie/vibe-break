import { listen } from "@tauri-apps/api/event";
import { appState, type AiState } from "$lib/stores.svelte";
import { logger } from "$lib/logger";
import { STATUS } from "$lib/strings";

export type ActionCommand = {
  type: "play_anim" | "expression" | "bone_pose";
  name?: string;
  url?: string;
  weight?: number;
  bone?: string;
  x?: number;
  y?: number;
  z?: number;
};

export type McpEventPayload = {
  type: "thinking" | "thinking:end" | "trigger:write" | "trigger:exec" | "trigger:read" | "system:done" | "system:error" | "system:progress" | "trigger:url";
  meta?: Record<string, unknown>;
  ts?: number;
  actions?: ActionCommand[];
};

const AI_ANIM_MAP: Record<AiState, string | undefined> = {
  idle: undefined,
  thinking: "Thinking",
  done: "Clapping",
  error: "Sad",
};

function switchAnimation(state: AiState) {
  const animName = AI_ANIM_MAP[state];
  if (!animName) {
    appState.aiState = state;
    return;
  }
  const match = appState.animList.find((a) => a.name === animName);
  if (!match) {
    appState.aiState = state;
    return;
  }
  appState.aiState = state;
  appState.selectedAnim = match.url;
  appState.status = state === "thinking"
    ? STATUS.THINKING
    : state === "done"
      ? STATUS.DONE
      : state === "error"
        ? STATUS.ERROR_MSG
        : "Idle";
}

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

    switch (type) {
      case "thinking":
        appState.aiState = "thinking";
        appState.mcpUi.encourageMessage = "";
        if (!appState.thinkingStart) {
          appState.thinkingStart = Date.now();
          appState.thinkingPeriods.push({ start: appState.thinkingStart });
        }
        switchAnimation("thinking");
        break;
      case "thinking:end":
        appState.aiState = "idle";
        if (payload.message) {
          appState.mcpUi.encourageMessage = payload.message;
        }
        if (appState.thinkingStart) {
          const last = appState.thinkingPeriods[appState.thinkingPeriods.length - 1];
          if (last && !last.end) last.end = Date.now();
          appState.thinkingStart = 0;
        }
        switchAnimation("idle");
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
        switchAnimation("error");
        break;
      case "system:done":
        appState.aiState = "done";
        switchAnimation("done");
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
