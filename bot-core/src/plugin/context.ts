import type { BotAPI } from "../services/BotAPI.js";
import type { PluginCommand } from "./types.js";

/** 带插件名的命令 */
export type CommandEntry = PluginCommand & { pluginName: string };

/**
 * 插件上下文
 * 提供给插件的运行时能力
 */
export interface PluginContext {
  /** 当前 Bot 的 ID */
  botId: string;

  /** Bot API 能力层 */
  api: BotAPI;

  /** 获取所有插件注册的命令 */
  getAllCommands(): CommandEntry[];

  /** 日志工具 */
  logger: PluginLogger;
}

/**
 * 插件日志工具
 * 自动带上插件名前缀
 */
export interface PluginLogger {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * 创建插件上下文
 * @param botId - Bot ID
 * @param pluginName - 插件名称
 * @param api - BotAPI 实例
 * @param commandGetter - 获取所有命令的回调
 */
export function createPluginContext(
  botId: string,
  pluginName: string,
  api: BotAPI,
  commandGetter: () => CommandEntry[],
): PluginContext {
  return {
    botId,
    api,
    getAllCommands: commandGetter,
    logger: {
      log: (...args: unknown[]) => console.log(`[Plugin:${pluginName}]`, ...args),
      warn: (...args: unknown[]) => console.warn(`[Plugin:${pluginName}]`, ...args),
      error: (...args: unknown[]) => console.error(`[Plugin:${pluginName}]`, ...args),
    },
  };
}
