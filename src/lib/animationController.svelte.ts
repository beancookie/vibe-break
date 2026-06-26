import { appState, type AiState } from "$lib/stores.svelte";
import { subscribe } from "$lib/eventBus.svelte";
import { STATUS } from "$lib/strings";

const AI_ANIM_MAP: Record<AiState, string | undefined> = {
  idle: undefined,
  thinking: "Thinking",
  done: "Clapping",
  error: "Sad",
};

export function startAnimationController() {
  subscribe("mcp:event", (payload) => {
    if (payload.type === "thinking") {
      switchAnimation("thinking");
    } else if (payload.type === "thinking:end") {
      switchAnimation("idle");
    } else if (payload.type === "system:done") {
      switchAnimation("done");
    } else if (payload.type === "system:error") {
      switchAnimation("error");
    }
  });
}

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
        : STATUS.IDLE;
}
