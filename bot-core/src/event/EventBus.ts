import type { BotEvent, EventTypeMap } from "./EventTypes.js";
import { EmitEventContext } from "./EventContext.js";

/** 事件处理函数类型 */
type EventHandler<T = unknown> = (event: T, ctx: EmitEventContext<T>) => void | Promise<void>;

/** Handler 注册信息 */
interface HandlerRegistration<T = unknown> {
  handler: EventHandler<T>;
  priority: number;
  id: symbol;
}

/** on() 选项 */
interface OnOptions {
  /** 优先级，数字越小越先执行，默认 100 */
  priority?: number;
}

/**
 * 事件总线
 * 支持优先级排序和 stopPropagation
 */
export class EventBus {
  private handlers = new Map<string, HandlerRegistration[]>();

  /**
   * 监听事件
   * @param event - 事件类型
   * @param handler - 事件处理函数
   * @param options - 选项（priority）
   * @returns dispose 函数，调用后自动移除监听
   */
  on<K extends keyof EventTypeMap>(event: K, handler: EventHandler<EventTypeMap[K]>, options?: OnOptions): () => void;
  on(event: string, handler: EventHandler, options?: OnOptions): () => void;
  on(event: string, handler: EventHandler, options?: OnOptions): () => void {
    const reg: HandlerRegistration = {
      handler,
      priority: options?.priority ?? 100,
      id: Symbol(event),
    };

    const list = this.handlers.get(event);
    if (!list) {
      this.handlers.set(event, [reg]);
    } else {
      // 按优先级插入（稳定排序：同优先级保持插入顺序）
      const idx = list.findIndex((r) => r.priority > reg.priority);
      if (idx === -1) {
        list.push(reg);
      } else {
        list.splice(idx, 0, reg);
      }
    }

    // 返回 dispose 函数
    return () => this.off(event, handler);
  }

  /**
   * 取消监听
   * @param event - 事件类型
   * @param handler - 要移除的处理函数
   */
  off<K extends keyof EventTypeMap>(event: K, handler: EventHandler<EventTypeMap[K]>): void;
  off(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void {
    const list = this.handlers.get(event);
    if (!list) return;
    const idx = list.findIndex((r) => r.handler === handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  /**
   * 触发事件（同步，按优先级顺序执行）
   * @param event - 事件类型
   * @param data - 事件数据
   * @returns 事件上下文（可检查 propagationStopped）
   */
  emit<K extends keyof EventTypeMap>(event: K, data: EventTypeMap[K]): EmitEventContext<EventTypeMap[K]>;
  emit(event: string, data: unknown): EmitEventContext;
  emit(event: string, data: unknown): EmitEventContext {
    const ctx = new EmitEventContext(data);
    const list = this.handlers.get(event);
    if (!list) return ctx;

    for (const reg of list) {
      if (ctx.propagationStopped) break;
      ctx._markHandled();
      try {
        reg.handler(data, ctx);
      } catch (err) {
        console.error(`[EventBus] handler error for "${event}":`, err);
      }
    }
    return ctx;
  }

  /**
   * 触发事件（异步，按优先级顺序执行，支持 stopPropagation）
   * @param event - 事件类型
   * @param data - 事件数据
   * @returns 事件上下文
   */
  async emitAsync<K extends keyof EventTypeMap>(event: K, data: EventTypeMap[K]): Promise<EmitEventContext<EventTypeMap[K]>>;
  async emitAsync(event: string, data: unknown): Promise<EmitEventContext>;
  async emitAsync(event: string, data: unknown): Promise<EmitEventContext> {
    const ctx = new EmitEventContext(data);
    const list = this.handlers.get(event);
    if (!list) return ctx;

    for (const reg of list) {
      if (ctx.propagationStopped) break;
      ctx._markHandled();
      try {
        await reg.handler(data, ctx);
      } catch (err) {
        console.error(`[EventBus] handler error for "${event}":`, err);
      }
    }
    return ctx;
  }

  /**
   * 根据 BotEvent 的 post_type 自动分发事件（同步）
   * @param event - 原始事件对象
   */
  dispatch(event: BotEvent): EmitEventContext {
    return this.emit(event.post_type as keyof EventTypeMap, event as never);
  }

  /**
   * 根据 BotEvent 的 post_type 自动分发事件（异步）
   * @param event - 原始事件对象
   */
  async dispatchAsync(event: BotEvent): Promise<EmitEventContext> {
    return this.emitAsync(event.post_type as keyof EventTypeMap, event as never);
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
    return this.handlers.get(event)?.length ?? 0;
  }
}
