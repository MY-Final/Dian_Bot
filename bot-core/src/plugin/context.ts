import type { BotAPI } from "../services/BotAPI.js";
import type { PluginCommand, PluginStatus } from "./types.js";
import type { EmitEventContext } from "../event/EventContext.js";
import type { PluginBus } from "./PluginBus.js";
import type { PluginScheduler } from "./PluginScheduler.js";
import type { PluginStore } from "./PluginStore.js";

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

/** 插件配置能力 */
export interface PluginConfigAccessor {
  /** 获取配置项 */
  get<T>(key: string, defaultVal: T): Promise<T>;
  /** 设置配置项 */
  set(key: string, value: unknown): Promise<void>;
  /** 检查配置项是否存在 */
  has(key: string): Promise<boolean>;
  /** 删除配置项 */
  delete(key: string): Promise<void>;
}

/** 插件冷却能力 */
export interface PluginCooldownAccessor {
  /** 检查是否在冷却中 */
  check(userId: number | string): boolean;
  /** 设置冷却（秒） */
  set(userId: number | string, seconds: number): void;
  /** 获取剩余冷却时间（秒） */
  remaining(userId: number | string): number;
  /** 清除冷却 */
  clear(userId?: number | string): void;
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

  /** 插件配置（持久化） */
  config: PluginConfigAccessor;

  /** 插件冷却 */
  cooldown: PluginCooldownAccessor;

  /** 插件间通信 */
  bus: PluginBus;

  /** 定时任务调度器 */
  scheduler: PluginScheduler;

  /** 持久化存储 */
  store: PluginStore;

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
 */
export function createPluginContext(
  botId: string,
  pluginName: string,
  api: BotAPI,
  commandGetter: () => CommandEntry[],
  control: PluginControl,
  configAccessor: PluginConfigAccessor,
  cooldownAccessor: PluginCooldownAccessor,
  bus: PluginBus,
  scheduler: PluginScheduler,
  store: PluginStore,
): PluginContext {
  return {
    botId,
    api,
    control,
    config: configAccessor,
    cooldown: cooldownAccessor,
    bus,
    scheduler,
    store,
    getAllCommands: commandGetter,
    logger: {
      log: (...args: unknown[]) => console.log(`[Plugin:${pluginName}]`, ...args),
      warn: (...args: unknown[]) => console.warn(`[Plugin:${pluginName}]`, ...args),
      error: (...args: unknown[]) => console.error(`[Plugin:${pluginName}]`, ...args),
    },
  };
}
