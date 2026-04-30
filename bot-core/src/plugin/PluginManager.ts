import type { Plugin } from "./types.js";
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
    const ctx = createPluginContext(this.botId, plugin.name, this.api);
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

    try {
      await plugin.onUnload?.();
    } catch (err) {
      console.error(`[PluginManager] 插件 "${pluginName}" 卸载失败:`, err);
    }

    this.plugins.delete(pluginName);
    this.contexts.delete(pluginName);
    console.log(`[PluginManager] 插件 "${pluginName}" 已卸载`);
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
    // 消息事件
    if (plugin.onMessage) {
      this.eventBus.on("message", (event: MessageEvent) => {
        try {
          plugin.onMessage!(event, ctx);
        } catch (err) {
          console.error(`[PluginManager] 插件 "${plugin.name}" onMessage 错误:`, err);
        }
      });
    }

    // 通知事件
    if (plugin.onNotice) {
      this.eventBus.on("notice", (event: NoticeEvent) => {
        try {
          plugin.onNotice!(event, ctx);
        } catch (err) {
          console.error(`[PluginManager] 插件 "${plugin.name}" onNotice 错误:`, err);
        }
      });
    }

    // 请求事件
    if (plugin.onRequest) {
      this.eventBus.on("request", (event: RequestEvent) => {
        try {
          plugin.onRequest!(event, ctx);
        } catch (err) {
          console.error(`[PluginManager] 插件 "${plugin.name}" onRequest 错误:`, err);
        }
      });
    }
  }
}
