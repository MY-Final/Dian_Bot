/** 插件间事件处理函数 */
type PluginBusHandler = (data: unknown) => void | Promise<void>;

/**
 * 插件间通信总线
 * 插件通过 ctx.bus 发送自定义事件，其他插件监听
 */
export class PluginBus {
  private handlers = new Map<string, Set<PluginBusHandler>>();

  /**
   * 发送自定义事件
   * @param event - 事件名称
   * @param data - 事件数据
   */
  emit(event: string, data?: unknown): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[PluginBus] handler error for "${event}":`, err);
      }
    }
  }

  /**
   * 监听自定义事件
   * @param event - 事件名称
   * @param handler - 处理函数
   * @returns dispose 函数
   */
  on(event: string, handler: PluginBusHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => this.off(event, handler);
  }

  /**
   * 监听一次
   * @param event - 事件名称
   * @param handler - 处理函数
   * @returns dispose 函数
   */
  once(event: string, handler: PluginBusHandler): () => void {
    const wrapper: PluginBusHandler = (data) => {
      this.off(event, wrapper);
      handler(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * 取消监听
   * @param event - 事件名称
   * @param handler - 处理函数
   */
  off(event: string, handler: PluginBusHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.handlers.clear();
  }
}
