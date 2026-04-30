import type { BotAPI } from "../services/BotAPI.js";
import type { PluginCommand, PluginStatus } from "./types.js";

/** 带插件名的命令 */
export type CommandEntry = PluginCommand & { pluginName: string };

/** 插件信息 */
export interface PluginInfo {
  name: string;
  description?: string | undefined;
  version?: string | undefined;
  status: PluginStatus;
  commands: PluginCommand[];
}

/** 插件管理能力 */
export interface PluginControl {
  /** 启用插件 */
  enable(pluginName: string): Promise<boolean>;
  /** 停用插件 */
  disable(pluginName: string): Promise<boolean>;
  /** 切换插件状态 */
  toggle(pluginName: string): Promise<PluginStatus | null>;
  /** 获取插件状态 */
  getStatus(pluginName: string): PluginStatus | undefined;
  /** 获取所有插件信息 */
  getAllPluginInfos(): PluginInfo[];
}

/**
 * 插件上下文
 * 提供给插件的运行时能力
 */
export interface PluginContext {
  /** 当前 Bot 的 ID */
  botId: string;

  /** Bot API 能力层 */
  api: BotAPI;

  /** 插件管理能力（用于管理其他插件） */
  control: PluginControl;

  /** 获取所有启用插件注册的命令 */
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
 * @param control - 插件管理能力
 */
export function createPluginContext(
  botId: string,
  pluginName: string,
  api: BotAPI,
  commandGetter: () => CommandEntry[],
  control: PluginControl,
): PluginContext {
  return {
    botId,
    api,
    control,
    getAllCommands: commandGetter,
    logger: {
      log: (...args: unknown[]) => console.log(`[Plugin:${pluginName}]`, ...args),
      warn: (...args: unknown[]) => console.warn(`[Plugin:${pluginName}]`, ...args),
      error: (...args: unknown[]) => console.error(`[Plugin:${pluginName}]`, ...args),
    },
  };
}
