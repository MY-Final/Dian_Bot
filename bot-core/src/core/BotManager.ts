import { BotClient, type BotClientConfig } from "./BotClient.js";

/**
 * Bot 多实例管理器
 * 负责创建、销毁和查询 BotClient 实例
 */
export class BotManager {
  private bots = new Map<string, BotClient>();

  /**
   * 创建并启动一个 Bot 实例
   * @param config - Bot 配置
   * @returns 创建的 BotClient 实例
   */
  createBot(config: BotClientConfig): BotClient {
    if (this.bots.has(config.botId)) {
      throw new Error(`[BotManager] Bot "${config.botId}" 已存在`);
    }

    const client = new BotClient(config);
    this.bots.set(config.botId, client);
    client.start();

    console.log(`[BotManager] Bot "${config.botId}" 已创建并启动`);
    return client;
  }

  /**
   * 获取指定 Bot 实例
   * @param botId - Bot 唯一标识
   */
  getBot(botId: string): BotClient | undefined {
    return this.bots.get(botId);
  }

  /**
   * 获取所有 Bot 实例
   */
  getAllBots(): BotClient[] {
    return Array.from(this.bots.values());
  }

  /**
   * 销毁指定 Bot 实例
   * @param botId - Bot 唯一标识
   */
  destroyBot(botId: string): boolean {
    const client = this.bots.get(botId);
    if (!client) return false;

    client.stop();
    this.bots.delete(botId);
    console.log(`[BotManager] Bot "${botId}" 已销毁`);
    return true;
  }

  /**
   * 销毁所有 Bot 实例
   */
  destroyAll(): void {
    for (const [botId, client] of this.bots) {
      client.stop();
      console.log(`[BotManager] Bot "${botId}" 已销毁`);
    }
    this.bots.clear();
  }

  /**
   * 获取 Bot 实例数量
   */
  get size(): number {
    return this.bots.size;
  }
}
