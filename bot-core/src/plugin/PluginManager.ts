import type { Plugin, PluginCommand } from "./types.js";
import type { PluginContext } from "./context.js";
import type { BotAPI } from "../services/BotAPI.js";
import { createPluginContext } from "./context.js";
import type { EventBus } from "../event/EventBus.js";
import type { MessageEvent, NoticeEvent, RequestEvent } from "../event/EventTypes.js";

/**
 * 插件管理器
 * 负责插件的注册、生命周期管理和事件分发
 */
export class PluginManager {
  private plugins = new Map<string, Plugin>();
  private contexts = new Map<string, PluginContext>();
  /** 每个插件绑定的事件处理器（用于卸载时清理） */
  private boundHandlers = new Map<string, Array<{ event: string; handler: (e: unknown) => void }>>();
  private botId: string;
  private api: BotAPI;
  private eventBus: EventBus;

  constructor(botId: string, api: BotAPI, eventBus: EventBus) {
    this.botId = botId;
    this.api = api;
    this.eventBus = eventBus;
  }

  /**
   * 注册插件
   * @param plugin - 插件实例
   */
  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[PluginManager] 插件 "${plugin.name}" 已注册，跳过`);
      return;
    }

    // 创建上下文
    const ctx = createPluginContext(this.botId, plugin.name, this.api, () => this.getAllCommands());
    this.plugins.set(plugin.name, plugin);
    this.contexts.set(plugin.name, ctx);

    // 调用 onLoad
    try {
      await plugin.onLoad?.(ctx);
      console.log(`[PluginManager] 插件 "${plugin.name}" 已加载`);
    } catch (err) {
      console.error(`[PluginManager] 插件 "${plugin.name}" 加载失败:`, err);
      this.plugins.delete(plugin.name);
      this.contexts.delete(plugin.name);
      return;
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
    console.log(`[PluginManager] 插件 "${pluginName}" 已卸载`);
  }

  /**
   * 热重载插件
   * 卸载旧插件，注册新插件实例
   * @param pluginName - 插件名称
   * @param newPlugin - 新的插件实例
   */
  async reload(pluginName: string, newPlugin: Plugin): Promise<void> {
    console.log(`[PluginManager] 热重载插件 "${pluginName}"...`);
    await this.unregister(pluginName);
    await this.register(newPlugin);
    console.log(`[PluginManager] 插件 "${pluginName}" 热重载完成`);
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
   * 获取所有插件注册的命令
   * @returns 命令列表，包含所属插件名
   */
  getAllCommands(): Array<PluginCommand & { pluginName: string }> {
    const commands: Array<PluginCommand & { pluginName: string }> = [];
    for (const plugin of this.plugins.values()) {
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
   */
  private bindPluginEvents(plugin: Plugin, ctx: PluginContext): void {
    const handlers: Array<{ event: string; handler: (e: unknown) => void }> = [];

    // 消息事件
    if (plugin.onMessage) {
      const handler = (event: MessageEvent) => {
        try {
          plugin.onMessage!(event, ctx);
        } catch (err) {
          console.error(`[PluginManager] 插件 "${plugin.name}" onMessage 错误:`, err);
        }
      };
      this.eventBus.on("message", handler);
      handlers.push({ event: "message", handler: handler as (e: unknown) => void });
    }

    // 通知事件
    if (plugin.onNotice) {
      const handler = (event: NoticeEvent) => {
        try {
          plugin.onNotice!(event, ctx);
        } catch (err) {
          console.error(`[PluginManager] 插件 "${plugin.name}" onNotice 错误:`, err);
        }
      };
      this.eventBus.on("notice", handler);
      handlers.push({ event: "notice", handler: handler as (e: unknown) => void });
    }

    // 请求事件
    if (plugin.onRequest) {
      const handler = (event: RequestEvent) => {
        try {
          plugin.onRequest!(event, ctx);
        } catch (err) {
          console.error(`[PluginManager] 插件 "${plugin.name}" onRequest 错误:`, err);
        }
      };
      this.eventBus.on("request", handler);
      handlers.push({ event: "request", handler: handler as (e: unknown) => void });
    }

    this.boundHandlers.set(plugin.name, handlers);
  }

  /**
   * 移除插件绑定的所有事件监听器
   */
  private unbindPluginEvents(pluginName: string): void {
    const handlers = this.boundHandlers.get(pluginName);
    if (!handlers) return;

    for (const { event, handler } of handlers) {
      this.eventBus.off(event, handler);
    }

    this.boundHandlers.delete(pluginName);
  }
}
