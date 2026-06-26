export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, tag: string, message: string): string {
  const ts = new Date().toISOString().slice(11, 23);
  return `[${ts}] [${level.toUpperCase()}] [${tag}] ${message}`;
}

function log(level: LogLevel, tag: string, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) return;
  const formatted = formatMessage(level, tag, message);
  switch (level) {
    case "debug":
      console.debug(formatted, ...args);
      break;
    case "info":
      console.info(formatted, ...args);
      break;
    case "warn":
      console.warn(formatted, ...args);
      break;
    case "error":
      console.error(formatted, ...args);
      break;
  }
}

export const logger = {
  debug: (tag: string, message: string, ...args: unknown[]) => log("debug", tag, message, ...args),
  info: (tag: string, message: string, ...args: unknown[]) => log("info", tag, message, ...args),
  warn: (tag: string, message: string, ...args: unknown[]) => log("warn", tag, message, ...args),
  error: (tag: string, message: string, ...args: unknown[]) => log("error", tag, message, ...args),
};
