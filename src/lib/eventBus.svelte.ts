import mitt from "mitt";

export type ActionCommand = {
  type: "play_anim" | "expression" | "bone_pose";
  name?: string;
  url?: string;
  speed?: number;
  weight?: number;
  bone?: string;
  x?: number;
  y?: number;
  z?: number;
};

export type McpEventPayload = {
  type: "thinking" | "thinking:end" | "file.write" | "command.exec" | "done" | "error" | "progress";
  meta?: Record<string, unknown>;
  ts?: number;
  actions?: ActionCommand[];
};

export type AppEvents = {
  "mcp:event": McpEventPayload;
  "animation:play": string;
  "animation:stop": void;
};

const emitter = mitt<AppEvents>();

export type Unsubscribe = () => void;

export function subscribe<Key extends keyof AppEvents>(
  type: Key,
  handler: (event: AppEvents[Key]) => void,
): Unsubscribe {
  emitter.on(type, handler as (event: unknown) => void);
  return () => {
    emitter.off(type, handler as (event: unknown) => void);
  };
}

export function emit<Key extends keyof AppEvents>(
  type: Key,
  event: AppEvents[Key],
): void {
  emitter.emit(type, event);
}

export { emitter as eventBus };
