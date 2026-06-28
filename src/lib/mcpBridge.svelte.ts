import { listen } from "@tauri-apps/api/event";
import { appState, setSelectedVrm, setSelectedAnim, setPetScale, bumpStopToken, type AiState } from "$lib/stores.svelte";
import { logger } from "$lib/logger";
import { STATUS } from "$lib/strings";
import { isTauri } from "@tauri-apps/api/core";

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
  type: "thinking" | "thinking:end" | "trigger:write" | "trigger:exec" | "trigger:read" | "trigger:search" | "system:done" | "system:error" | "system:progress" | "trigger:url" | "tool:call" | "tool:select_model" | "tool:play_animation" | "tool:set_scale" | "tool:set_always_on_top";
  meta?: Record<string, unknown>;
  ts?: number;
  actions?: ActionCommand[];
  message?: string;
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

function handleToolCall(toolName: string, meta: Record<string, unknown> | undefined) {
  const args = meta?.args as Record<string, unknown> | undefined;
  switch (toolName) {
    case "select_model": {
      const url = args?.url as string | undefined;
      if (url) {
        setSelectedVrm(url);
        bumpStopToken();
        appState.status = STATUS.SWITCHING_MODEL;
        logger.info("[MCP]", "select_model", url);
      }
      break;
    }
    case "play_animation": {
      const url = args?.url as string | undefined;
      if (url) {
        setSelectedAnim(url);
        appState.status = STATUS.SWITCHING_ANIM;
        logger.info("[MCP]", "play_animation", url);
      }
      break;
    }
    case "set_scale": {
      const scale = args?.scale as number | undefined;
      if (typeof scale === "number" && scale >= 0.1 && scale <= 10.0) {
        setPetScale(scale);
        logger.info("[MCP]", "set_scale", scale);
      }
      break;
    }
    case "set_always_on_top": {
      const onTop = args?.on_top as boolean | undefined;
      if (typeof onTop === "boolean" && isTauri()) {
        import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
          getCurrentWindow().setAlwaysOnTop(onTop);
        });
        appState.alwaysOnTop = onTop;
        logger.info("[MCP]", "set_always_on_top", onTop);
      }
      break;
    }
  }
}

function showMessage(msg: string | undefined) {
  if (msg) {
    appState.mcpUi.encourageMessage = msg;
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
        showMessage(payload.message);
        break;
      case "thinking:end":
        appState.aiState = "idle";
        if (appState.thinkingStart) {
          const last = appState.thinkingPeriods[appState.thinkingPeriods.length - 1];
          if (last && !last.end) last.end = Date.now();
          appState.thinkingStart = 0;
        }
        switchAnimation("idle");
        showMessage(payload.message);
        break;
      case "trigger:write":
        appState.counters.filesWritten++;
        showMessage(payload.message);
        break;
      case "trigger:exec":
        appState.counters.commandsRun++;
        showMessage(payload.message);
        break;
      case "trigger:read":
      case "trigger:search":
        showMessage(payload.message);
        break;
      case "system:error":
        appState.counters.errors++;
        appState.aiState = "error";
        appState.mcpUi.showErrorFeedback = true;
        const meta = payload.meta as Record<string, unknown> | undefined;
        appState.mcpUi.errorMsg = typeof meta?.message === "string" ? meta.message : "Unknown error";
        switchAnimation("error");
        showMessage(payload.message);
        break;
      case "system:done":
        appState.aiState = "done";
        switchAnimation("done");
        showMessage(payload.message);
        break;
      case "tool:select_model":
        handleToolCall("select_model", payload.meta);
        showMessage(payload.message);
        break;
      case "tool:play_animation":
        handleToolCall("play_animation", payload.meta);
        showMessage(payload.message);
        break;
      case "tool:set_scale":
        handleToolCall("set_scale", payload.meta);
        showMessage(payload.message);
        break;
      case "tool:set_always_on_top":
        handleToolCall("set_always_on_top", payload.meta);
        showMessage(payload.message);
        break;
      case "tool:call":
        const tn = payload.meta?.tool_name as string | undefined;
        if (tn) handleToolCall(tn, payload.meta);
        showMessage(payload.message);
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