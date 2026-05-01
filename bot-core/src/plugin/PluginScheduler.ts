/**
 * 插件调度器
 * 提供定时任务能力，插件卸载时自动清理
 */
export class PluginScheduler {
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private intervals = new Set<ReturnType<typeof setInterval>>();

  /**
   * 延迟执行
   * @param fn - 执行函数
   * @param ms - 延迟毫秒数
   * @returns 取消函数
   */
  setTimeout(fn: () => void | Promise<void>, ms: number): () => void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      try {
        fn();
      } catch (err) {
        console.error("[PluginScheduler] setTimeout error:", err);
      }
    }, ms);
    this.timers.add(timer);

    return () => {
      clearTimeout(timer);
      this.timers.delete(timer);
    };
  }

  /**
   * 间隔执行
   * @param fn - 执行函数
   * @param ms - 间隔毫秒数
   * @returns 取消函数
   */
  setInterval(fn: () => void | Promise<void>, ms: number): () => void {
    const timer = setInterval(() => {
      try {
        fn();
      } catch (err) {
        console.error("[PluginScheduler] setInterval error:", err);
      }
    }, ms);
    this.intervals.add(timer);

    return () => {
      clearInterval(timer);
      this.intervals.delete(timer);
    };
  }

  /**
   * 清理所有定时任务
   */
  clearAll(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    for (const timer of this.intervals) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.intervals.clear();
  }
}
