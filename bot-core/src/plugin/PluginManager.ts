import type { Plugin, PluginCommand, PluginStatus, PluginPriority } from "./types.js";
import type { PluginContext, PluginControl, PluginInfo } from "./context.js";
import type { BotAPI } from "../services/BotAPI.js";
import { createPluginContext } from "./context.js";
import type { EventBus } from "../event/EventBus.js";
import type { EmitEventContext } from "../event/EventContext.js";
import type { MessageEvent, NoticeEvent, RequestEvent } from "../event/EventTypes.js";

/** 默认优先级 */
const DEFAULT_PRIORITY = 100;

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
  /** 插件管理能力（注入到上下文） */
  private control: PluginControl;

  constructor(botId: string, api: BotAPI, eventBus: EventBus) {
    this.botId = botId;
    this.api = api;
    this.eventBus = eventBus;

    // 创建 control 对象，延迟绑定到 this
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

    // 创建上下文
    const ctx = createPluginContext(this.botId, plugin.name, this.api, () => this.getAllCommands(), this.control);
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

    this.plugins.delete(pluginName);
    this.contexts.delete(pluginName);
    this.statuses.delete(pluginName);
    console.log(`[PluginManager] 插件 "${pluginName}" 已卸载`);
  }

  /**
   * 热重载插件
   * 卸载旧插件，注册新插件实例，保留原有状态
   * @param pluginName - 插件名称
   * @param newPlugin - 新的插件实例
   */
  async reload(pluginName: string, newPlugin: Plugin): Promise<void> {
    // 记住原来的状态
    const wasEnabled = this.statuses.get(pluginName) !== "disabled";

    console.log(`[PluginManager] 热重载插件 "${pluginName}"...`);

    // 注销（会触发 onDisable + onUnload）
    await this.unregister(pluginName);

    // 注册新实例
    await this.register(newPlugin);

    // 如果原来是停用的，注册后立即停用
    if (!wasEnabled) {
      await this.disable(newPlugin.name);
    }

    console.log(`[PluginManager] 插件 "${pluginName}" 热重载完成`);
  }

  /**
   * 启用插件
   * @param pluginName - 插件名称
   */
  async enable(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    const ctx = this.contexts.get(pluginName);
    if (!plugin || !ctx) return false;

    if (this.statuses.get(pluginName) === "enabled") {
      return true; // 已经是启用状态
    }

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
   * @param pluginName - 插件名称
   */
  async disable(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    const ctx = this.contexts.get(pluginName);
    if (!plugin || !ctx) return false;

    if (this.statuses.get(pluginName) === "disabled") {
      return true; // 已经是停用状态
    }

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
   * @param pluginName - 插件名称
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

  /**
   * 获取插件状态
   * @param pluginName - 插件名称
   */
  getStatus(pluginName: string): PluginStatus | undefined {
    return this.statuses.get(pluginName);
  }

  /**
   * 检查插件是否已注册且启用
   * @param pluginName - 插件名称
   */
  isEnabled(pluginName: string): boolean {
    return this.statuses.get(pluginName) === "enabled";
  }

  /**
   * 检查插件是否已注册
   */
  has(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  /**
   * 获取插件
   * @param pluginName - 插件名称
   */
  getPlugin(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * 获取所有已注册插件
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取所有插件信息（含状态）
   */
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

  /**
   * 获取所有插件注册的命令（仅启用的插件）
   * @returns 命令列表，包含所属插件名
   */
  getAllCommands(): Array<PluginCommand & { pluginName: string }> {
    const commands: Array<PluginCommand & { pluginName: string }> = [];
    for (const [name, plugin] of this.plugins) {
      // 只收集启用插件的命令
      if (this.statuses.get(name) !== "enabled") continue;
      if (plugin.commands) {
        for (const cmd of plugin.commands) {
          commands.push({ ...cmd, pluginName: plugin.name });
        }
      }
    }
    return commands;
  }

  /**
   * 卸载所有插件
   */
  async unregisterAll(): Promise<void> {
    for (const pluginName of this.plugins.keys()) {
      await this.unregister(pluginName);
    }
  }

  /**
   * 将插件的事件处理函数绑定到事件总线
   * 使用插件配置的优先级
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
