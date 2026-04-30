import { BotManager } from "./BotManager.js";
import { BotClient, type BotClientConfig } from "./BotClient.js";
import { PluginManager } from "../plugin/PluginManager.js";
import { PluginLoader } from "../plugin/PluginLoader.js";
import { PluginWatcher } from "../plugin/PluginWatcher.js";

/** Runtime 配置 */
export interface RuntimeConfig {
  /** Bot 实例配置列表 */
  bots: BotClientConfig[];
  /** 插件目录路径（相对于项目根目录） */
  pluginsDir?: string;
  /** 是否启用插件热重载（默认 true） */
  hotReload?: boolean;
}

/**
 * 运行时入口
 * 初始化并管理整个 Bot 系统
 */
export class Runtime {
  private config: RuntimeConfig;
  private botManager: BotManager;
  private pluginManagers = new Map<string, PluginManager>();
  private pluginLoader: PluginLoader;
  private pluginWatcher: PluginWatcher | null = null;

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.botManager = new BotManager();
    this.pluginLoader = new PluginLoader();
  }

  /**
   * 启动运行时
   * 创建所有 Bot 实例，加载插件，启动监听
   */
  async start(): Promise<void> {
    console.log("[Runtime] 启动中...");

    // 创建 Bot 实例
    for (const botConfig of this.config.bots) {
      try {
        const client = this.botManager.createBot(botConfig);

        // 为每个 Bot 创建插件管理器
        const pluginManager = new PluginManager(
          botConfig.botId,
          client.api,
          client.eventBus,
        );
        this.pluginManagers.set(botConfig.botId, pluginManager);
      } catch (err) {
        console.error(`[Runtime] 创建 Bot "${botConfig.botId}" 失败:`, err);
      }
    }

    // 加载插件
    if (this.config.pluginsDir) {
      await this.loadPlugins(this.config.pluginsDir);

      // 启动插件监听（热重载）
      const hotReload = this.config.hotReload !== false; // 默认开启
      if (hotReload) {
        await this.startWatcher(this.config.pluginsDir);
      }
    }

    console.log(`[Runtime] 已启动 ${this.botManager.size} 个 Bot 实例`);
  }

  /**
   * 从目录加载插件并注册到所有 Bot
   * @param dir - 插件目录路径
   */
  private async loadPlugins(dir: string): Promise<void> {
    const plugins = await this.pluginLoader.loadFromDir(dir);

    for (const [botId, pluginManager] of this.pluginManagers) {
      for (const plugin of plugins) {
        try {
          await pluginManager.register(plugin);
        } catch (err) {
          console.error(`[Runtime] 注册插件 "${plugin.name}" 到 Bot "${botId}" 失败:`, err);
        }
      }
    }

    console.log(`[Runtime] 已加载 ${plugins.length} 个插件`);
  }

  /**
   * 启动插件目录监听
   * @param dir - 插件目录路径
   */
  private async startWatcher(dir: string): Promise<void> {
    this.pluginWatcher = new PluginWatcher(dir);

    this.pluginWatcher.onChange(async (event) => {
      switch (event.type) {
        case "add": {
          // 新插件：加载并注册到所有 Bot
          const plugin = await this.pluginLoader.loadSingle(event.pluginName, event.dirPath);
          if (!plugin) return;
          for (const [botId, pm] of this.pluginManagers) {
            try {
              await pm.register(plugin);
            } catch (err) {
              console.error(`[Runtime] 注册插件 "${plugin.name}" 到 Bot "${botId}" 失败:`, err);
            }
          }
          break;
        }

        case "change": {
          // 插件修改：清除缓存，重新加载，热重载
          this.pluginLoader.invalidateCache(event.pluginName);
          const plugin = await this.pluginLoader.loadSingle(event.pluginName, event.dirPath);
          if (!plugin) return;
          for (const [botId, pm] of this.pluginManagers) {
            try {
              await pm.reload(event.pluginName, plugin);
            } catch (err) {
              console.error(`[Runtime] 热重载插件 "${plugin.name}" 到 Bot "${botId}" 失败:`, err);
            }
          }
          break;
        }

        case "remove": {
          // 插件删除：卸载
          for (const [botId, pm] of this.pluginManagers) {
            try {
              await pm.unregister(event.pluginName);
            } catch (err) {
              console.error(`[Runtime] 卸载插件 "${event.pluginName}" 从 Bot "${botId}" 失败:`, err);
            }
          }
          break;
        }
      }
    });

    await this.pluginWatcher.start();
    console.log("[Runtime] 插件热重载已启用");
  }

  /**
   * 停止运行时
   * 卸载插件并销毁所有 Bot 实例
   */
  async stop(): Promise<void> {
    console.log("[Runtime] 停止中...");

    // 停止监听
    if (this.pluginWatcher) {
      this.pluginWatcher.stop();
      this.pluginWatcher = null;
    }

    // 卸载所有插件
    for (const [botId, pluginManager] of this.pluginManagers) {
      await pluginManager.unregisterAll();
      console.log(`[Runtime] Bot "${botId}" 插件已卸载`);
    }
    this.pluginManagers.clear();

    // 销毁所有 Bot
    this.botManager.destroyAll();
    console.log("[Runtime] 已停止");
  }

  /**
   * 获取 Bot 管理器
   */
  getBotManager(): BotManager {
    return this.botManager;
  }

  /**
   * 获取指定 Bot 的插件管理器
   * @param botId - Bot ID
   */
  getPluginManager(botId: string): PluginManager | undefined {
    return this.pluginManagers.get(botId);
  }
}
