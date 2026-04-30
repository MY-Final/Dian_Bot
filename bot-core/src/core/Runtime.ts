import { BotManager } from "./BotManager.js";
import type { BotClientConfig } from "./BotClient.js";

/** Runtime 配置 */
export interface RuntimeConfig {
  /** Bot 实例配置列表 */
  bots: BotClientConfig[];
  /** 插件目录路径（相对于项目根目录） */
  pluginsDir?: string;
}

/**
 * 运行时入口
 * 初始化并管理整个 Bot 系统
 */
export class Runtime {
  private config: RuntimeConfig;
  private botManager: BotManager;

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.botManager = new BotManager();
  }

  /**
   * 启动运行时
   * 创建所有 Bot 实例并连接
   */
  start(): void {
    console.log("[Runtime] 启动中...");

    // 创建 Bot 实例
    for (const botConfig of this.config.bots) {
      try {
        this.botManager.createBot(botConfig);
      } catch (err) {
        console.error(`[Runtime] 创建 Bot "${botConfig.botId}" 失败:`, err);
      }
    }

    console.log(`[Runtime] 已启动 ${this.botManager.size} 个 Bot 实例`);
  }

  /**
   * 停止运行时
   * 销毁所有 Bot 实例
   */
  stop(): void {
    console.log("[Runtime] 停止中...");
    this.botManager.destroyAll();
    console.log("[Runtime] 已停止");
  }

  /**
   * 获取 Bot 管理器
   */
  getBotManager(): BotManager {
    return this.botManager;
  }
}
