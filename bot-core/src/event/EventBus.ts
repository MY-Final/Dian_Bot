import type { BotEvent, EventTypeMap, PostType } from "./EventTypes.js";

/** 事件处理函数类型 */
type EventHandler<T = unknown> = (event: T) => void | Promise<void>;

/**
 * 事件总线
 * 负责事件的注册、触发和分发
 */
export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  /**
   * 监听事件
   * @param event - 事件类型（post_type 值）
   * @param handler - 事件处理函数
   */
  on<K extends keyof EventTypeMap>(event: K, handler: EventHandler<EventTypeMap[K]>): void;
  on(event: string, handler: EventHandler): void;
  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  /**
   * 取消监听
   * @param event - 事件类型
   * @param handler - 要移除的处理函数
   */
  off<K extends keyof EventTypeMap>(event: K, handler: EventHandler<EventTypeMap[K]>): void;
  off(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  /**
   * 触发事件（同步，不等待 handler 完成）
   * @param event - 事件类型
   * @param data - 事件数据
   */
  emit<K extends keyof EventTypeMap>(event: K, data: EventTypeMap[K]): void;
  emit(event: string, data: unknown): void;
  emit(event: string, data: unknown): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[EventBus] handler error for "${event}":`, err);
      }
    }
  }

  /**
   * 触发事件（异步，等待所有 handler 完成）
   * @param event - 事件类型
   * @param data - 事件数据
   */
  async emitAsync<K extends keyof EventTypeMap>(event: K, data: EventTypeMap[K]): Promise<void>;
  async emitAsync(event: string, data: unknown): Promise<void>;
  async emitAsync(event: string, data: unknown): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    const promises: Promise<void>[] = [];
    for (const handler of handlers) {
      try {
        const result = handler(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (err) {
        console.error(`[EventBus] handler error for "${event}":`, err);
      }
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  /**
   * 根据 BotEvent 的 post_type 自动分发事件
   * @param event - 原始事件对象
   */
  dispatch(event: BotEvent): void {
    this.emit(event.post_type as keyof EventTypeMap, event as never);
  }

  /**
   * 根据 BotEvent 的 post_type 自动分发事件（异步）
   * @param event - 原始事件对象
   */
  async dispatchAsync(event: BotEvent): Promise<void> {
    await this.emitAsync(event.post_type as keyof EventTypeMap, event as never);
  }

  /**
   * 移除所有监听器
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * 获取指定事件的监听器数量
   */
  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}
