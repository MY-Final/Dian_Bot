import type { Plugin, PluginCommand, PluginStatus, PluginPriority } from "./types.js";
import type { PluginContext, PluginControl, PluginInfo, PluginConfigAccessor, PluginCooldownAccessor } from "./context.js";
import type { BotAPI } from "../services/BotAPI.js";
import { createPluginContext } from "./context.js";
import type { EventBus } from "../event/EventBus.js";
import type { EmitEventContext } from "../event/EventContext.js";
import type { MessageEvent, NoticeEvent, RequestEvent } from "../event/EventTypes.js";
import { PluginConfigManager } from "./PluginConfig.js";
import { CooldownManager } from "./PluginCooldown.js";
import { PluginBus } from "./PluginBus.js";
import { PluginScheduler } from "./PluginScheduler.js";
import { JsonFileStore, type PluginStore } from "./PluginStore.js";

/** 默认优先级 */
const DEFAULT_PRIORITY = 100;

/** PluginManager 配置 */
export interface PluginManagerConfig {
  /** 插件目录路径 */
  pluginsDir: string;
}

/**
 * 插件管理器
 * 负责插件的注册、生命周期管理、状态管理和事件分发
 */
export class PluginManager {
  private plugins = new Map<string, Plugin>();
  private contexts = new Map<string, PluginContext>();
  private statuses = new Map<string, PluginStatus>();
  /** 每个插件绑定的事件处理器（用于卸载时清理） */
  private boundHandlers = new Map<string, Array<{ event: string; handler: (e: unknown, ctx: EmitEventContext) => void; dispose: () => void }>>();
  private botId: string;
  private api: BotAPI;
  private eventBus: EventBus;
  private pluginsDir: string;

  // 共享组件
  private configManager: PluginConfigManager;
  private cooldownManager: CooldownManager;
  private pluginBus: PluginBus;
  /** 每个插件独立的调度器 */
  private schedulers = new Map<string, PluginScheduler>();
  /** 每个插件独立的存储 */
  private stores = new Map<string, PluginStore>();

  /** 插件管理能力（注入到上下文） */
  private control: PluginControl;

  constructor(botId: string, api: BotAPI, eventBus: EventBus, config: PluginManagerConfig) {
    this.botId = botId;
    this.api = api;
    this.eventBus = eventBus;
    this.pluginsDir = config.pluginsDir;

    this.configManager = new PluginConfigManager(config.pluginsDir);
    this.cooldownManager = new CooldownManager();
    this.pluginBus = new PluginBus();

    // 创建 control 对象
    this.control = {
      enable: (name: string) => this.enable(name),
      disable: (name: string) => this.disable(name),
      toggle: (name: string) => this.toggle(name),
      getStatus: (name: string) => this.getStatus(name),
      getAllPluginInfos: () => this.getAllPluginInfos(),
    };
  }

  /**
   * 注册插件（默认启用）
   * @param plugin - 插件实例
   */
  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[PluginManager] 插件 "${plugin.name}" 已注册，跳过`);
      return;
    }

    // 创建该插件专属的调度器和存储
    const scheduler = new PluginScheduler();
    const store = new JsonFileStore(this.pluginsDir, plugin.name);
    this.schedulers.set(plugin.name, scheduler);
    this.stores.set(plugin.name, store);

    // 创建配置和冷却的访问器（绑定插件名）
    const configAccessor: PluginConfigAccessor = {
      get: <T>(key: string, defaultVal: T) => this.configManager.get<T>(plugin.name, key, defaultVal),
      set: (key: string, value: unknown) => this.configManager.set(plugin.name, key, value),
      has: (key: string) => this.configManager.has(plugin.name, key),
      delete: (key: string) => this.configManager.delete(plugin.name, key),
    };

    const cooldownAccessor: PluginCooldownAccessor = {
      check: (userId: number | string) => this.cooldownManager.isCooldown(plugin.name, userId),
      set: (userId: number | string, seconds: number) => this.cooldownManager.setCooldown(plugin.name, userId, seconds),
      remaining: (userId: number | string) => this.cooldownManager.getRemaining(plugin.name, userId),
      clear: (userId?: number | string) => this.cooldownManager.clear(plugin.name, userId),
    };

    // 创建上下文
    const ctx = createPluginContext(
      this.botId, plugin.name, this.api,
      () => this.getAllCommands(), this.control,
      configAccessor, cooldownAccessor,
      this.pluginBus, scheduler, store,
    );

    this.plugins.set(plugin.name, plugin);
    this.contexts.set(plugin.name, ctx);
    this.statuses.set(plugin.name, "enabled");

    // 调用 onLoad
    try {
      await plugin.onLoad?.(ctx);
      console.log(`[PluginManager] 插件 "${plugin.name}" 已加载`);
    } catch (err) {
      console.error(`[PluginManager] 插件 "${plugin.name}" 加载失败:`, err);
      this.plugins.delete(plugin.name);
      this.contexts.delete(plugin.name);
      this.statuses.delete(plugin.name);
      this.schedulers.delete(plugin.name);
      this.stores.delete(plugin.name);
      return;
    }

    // 调用 onEnable
    try {
      await plugin.onEnable?.(ctx);
    } catch (err) {
      console.error(`[PluginManager] 插件 "${plugin.name}" onEnable 错误:`, err);
    }

    // 注册事件监听
    this.bindPluginEvents(plugin, ctx);
  }

  /**
   * 注销插件
   * @param pluginName - 插件名称
   */
  async unregister(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return;

    // 调用 onDisable
    const ctx = this.contexts.get(pluginName);
    try {
      if (ctx) await plugin.onDisable?.(ctx);
    } catch (err) {
      console.error(`[PluginManager] 插件 "${pluginName}" onDisable 错误:`, err);
    }

    // 调用 onUnload
    try {
      await plugin.onUnload?.();
    } catch (err) {
      console.error(`[PluginManager] 插件 "${pluginName}" 卸载失败:`, err);
    }

    // 移除事件监听
    this.unbindPluginEvents(pluginName);

    // 清理插件专属资源
    this.schedulers.get(pluginName)?.clearAll();
    this.schedulers.delete(pluginName);
    this.stores.delete(pluginName);
    this.cooldownManager.clear(pluginName);
    this.configManager.clearCache(pluginName);

    this.plugins.delete(pluginName);
    this.contexts.delete(pluginName);
    this.statuses.delete(pluginName);
    console.log(`[PluginManager] 插件 "${pluginName}" 已卸载`);
  }

  /**
   * 热重载插件
   */
  async reload(pluginName: string, newPlugin: Plugin): Promise<void> {
    const wasEnabled = this.statuses.get(pluginName) !== "disabled";
    console.log(`[PluginManager] 热重载插件 "${pluginName}"...`);

    await this.unregister(pluginName);
    await this.register(newPlugin);

    if (!wasEnabled) {
      await this.disable(newPlugin.name);
    }

    console.log(`[PluginManager] 插件 "${pluginName}" 热重载完成`);
  }

  /**
   * 启用插件
   */
  async enable(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    const ctx = this.contexts.get(pluginName);
    if (!plugin || !ctx) return false;

    if (this.statuses.get(pluginName) === "enabled") return true;

    this.statuses.set(pluginName, "enabled");
    try {
      await plugin.onEnable?.(ctx);
    } catch (err) {
      console.error(`[PluginManager] 插件 "${pluginName}" onEnable 错误:`, err);
    }

    console.log(`[PluginManager] 插件 "${pluginName}" 已启用`);
    return true;
  }

  /**
   * 停用插件
   */
  async disable(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    const ctx = this.contexts.get(pluginName);
    if (!plugin || !ctx) return false;

    if (this.statuses.get(pluginName) === "disabled") return true;

    this.statuses.set(pluginName, "disabled");
    try {
      await plugin.onDisable?.(ctx);
    } catch (err) {
      console.error(`[PluginManager] 插件 "${pluginName}" onDisable 错误:`, err);
    }

    console.log(`[PluginManager] 插件 "${pluginName}" 已停用`);
    return true;
  }

  /**
   * 切换插件状态
   */
  async toggle(pluginName: string): Promise<PluginStatus | null> {
    const current = this.statuses.get(pluginName);
    if (!current) return null;

    if (current === "enabled") {
      await this.disable(pluginName);
      return "disabled";
    } else {
      await this.enable(pluginName);
      return "enabled";
    }
  }

  getStatus(pluginName: string): PluginStatus | undefined {
    return this.statuses.get(pluginName);
  }

  isEnabled(pluginName: string): boolean {
    return this.statuses.get(pluginName) === "enabled";
  }

  has(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  getPlugin(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getAllPluginInfos(): PluginInfo[] {
    const result: PluginInfo[] = [];
    for (const [name, plugin] of this.plugins) {
      result.push({
        name: plugin.name,
        description: plugin.description,
        version: plugin.version,
        status: this.statuses.get(name) ?? "enabled",
        commands: plugin.commands ?? [],
      });
    }
    return result;
  }

  getAllCommands(): Array<PluginCommand & { pluginName: string }> {
    const commands: Array<PluginCommand & { pluginName: string }> = [];
    for (const [name, plugin] of this.plugins) {
      if (this.statuses.get(name) !== "enabled") continue;
      if (plugin.commands) {
        for (const cmd of plugin.commands) {
          commands.push({ ...cmd, pluginName: plugin.name });
        }
      }
    }
    return commands;
  }

  async unregisterAll(): Promise<void> {
    for (const pluginName of this.plugins.keys()) {
      await this.unregister(pluginName);
    }
    this.pluginBus.clear();
  }

  /**
   * 将插件的事件处理函数绑定到事件总线
   */
  private bindPluginEvents(plugin: Plugin, ctx: PluginContext): void {
    const handlers: Array<{ event: string; handler: (e: unknown, ctx: EmitEventContext) => void; dispose: () => void }> = [];
    const priority = plugin.priority ?? {};

    // 消息事件
    if (plugin.onMessage) {
      const handler = (event: MessageEvent, emitCtx: EmitEventContext<MessageEvent>) => {
        if (this.statuses.get(plugin.name) !== "enabled") return;
        try {
          plugin.onMessage!(event, ctx, emitCtx);
        } catch (err) {
          console.error(`[PluginManager] 插件 "${plugin.name}" onMessage 错误:`, err);
        }
      };
      const dispose = this.eventBus.on("message", handler, { priority: priority.message ?? DEFAULT_PRIORITY });
      handlers.push({ event: "message", handler: handler as (e: unknown, ctx: EmitEventContext) => void, dispose });
    }

    // 通知事件
    if (plugin.onNotice) {
      const handler = (event: NoticeEvent, emitCtx: EmitEventContext<NoticeEvent>) => {
        if (this.statuses.get(plugin.name) !== "enabled") return;
        try {
          plugin.onNotice!(event, ctx, emitCtx);
        } catch (err) {
          console.error(`[PluginManager] 插件 "${plugin.name}" onNotice 错误:`, err);
        }
      };
      const dispose = this.eventBus.on("notice", handler, { priority: priority.notice ?? DEFAULT_PRIORITY });
      handlers.push({ event: "notice", handler: handler as (e: unknown, ctx: EmitEventContext) => void, dispose });
    }

    // 请求事件
    if (plugin.onRequest) {
      const handler = (event: RequestEvent, emitCtx: EmitEventContext<RequestEvent>) => {
        if (this.statuses.get(plugin.name) !== "enabled") return;
        try {
          plugin.onRequest!(event, ctx, emitCtx);
        } catch (err) {
          console.error(`[PluginManager] 插件 "${plugin.name}" onRequest 错误:`, err);
        }
      };
      const dispose = this.eventBus.on("request", handler, { priority: priority.request ?? DEFAULT_PRIORITY });
      handlers.push({ event: "request", handler: handler as (e: unknown, ctx: EmitEventContext) => void, dispose });
    }

    this.boundHandlers.set(plugin.name, handlers);
  }

  /**
   * 移除插件绑定的所有事件监听器
   */
  private unbindPluginEvents(pluginName: string): void {
    const handlers = this.boundHandlers.get(pluginName);
    if (!handlers) return;

    for (const { dispose } of handlers) {
      dispose();
    }

    this.boundHandlers.delete(pluginName);
  }
}
