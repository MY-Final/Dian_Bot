/**
 * 冷却管理器
 * 提供基于用户+插件的冷却机制
 */
export class CooldownManager {
  /** cooldowns: Map<"pluginName:userId", expireAt> */
  private cooldowns = new Map<string, number>();

  /**
   * 生成冷却 key
   */
  private getKey(pluginName: string, userId: number | string): string {
    return `${pluginName}:${userId}`;
  }

  /**
   * 检查是否在冷却中
   * @param pluginName - 插件名称
   * @param userId - 用户 ID
   * @returns true 表示还在冷却中
   */
  isCooldown(pluginName: string, userId: number | string): boolean {
    const key = this.getKey(pluginName, userId);
    const expireAt = this.cooldowns.get(key);
    if (!expireAt) return false;

    if (Date.now() >= expireAt) {
      this.cooldowns.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 设置冷却
   * @param pluginName - 插件名称
   * @param userId - 用户 ID
   * @param seconds - 冷却秒数
   */
  setCooldown(pluginName: string, userId: number | string, seconds: number): void {
    const key = this.getKey(pluginName, userId);
    this.cooldowns.set(key, Date.now() + seconds * 1000);
  }

  /**
   * 获取剩余冷却时间（秒）
   * @param pluginName - 插件名称
   * @param userId - 用户 ID
   * @returns 剩余秒数，0 表示不在冷却中
   */
  getRemaining(pluginName: string, userId: number | string): number {
    const key = this.getKey(pluginName, userId);
    const expireAt = this.cooldowns.get(key);
    if (!expireAt) return 0;

    const remaining = Math.ceil((expireAt - Date.now()) / 1000);
    if (remaining <= 0) {
      this.cooldowns.delete(key);
      return 0;
    }
    return remaining;
  }

  /**
   * 清除指定冷却
   * @param pluginName - 插件名称
   * @param userId - 用户 ID（不传则清除该插件所有冷却）
   */
  clear(pluginName: string, userId?: number | string): void {
    if (userId !== undefined) {
      this.cooldowns.delete(this.getKey(pluginName, userId));
    } else {
      // 清除该插件所有冷却
      const prefix = `${pluginName}:`;
      for (const key of this.cooldowns.keys()) {
        if (key.startsWith(prefix)) {
          this.cooldowns.delete(key);
        }
      }
    }
  }

  /**
   * 清除所有过期冷却（定期清理）
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, expireAt] of this.cooldowns) {
      if (now >= expireAt) {
        this.cooldowns.delete(key);
      }
    }
  }
}
