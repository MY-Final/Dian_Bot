import type { MessageEvent, NoticeEvent, RequestEvent } from "../event/EventTypes.js";
import type { EmitEventContext } from "../event/EventContext.js";
import type { PluginContext } from "./context.js";

/** 插件状态 */
export type PluginStatus = "enabled" | "disabled";

/** 插件优先级 */
export interface PluginPriority {
  /** 消息事件处理优先级，默认 100 */
  message?: number;
  /** 通知事件处理优先级，默认 100 */
  notice?: number;
  /** 请求事件处理优先级，默认 100 */
  request?: number;
}

/** 插件命令定义 */
export interface PluginCommand {
  /** 命令触发词，例如 "/ping"、"帮助" */
  command: string;
  /** 命令说明 */
  description: string;
  /** 用法示例，例如 "/ping" */
  usage?: string;
}

/**
 * 插件接口
 * 所有插件必须实现此接口
 */
export interface Plugin {
  /** 插件名称（唯一标识） */
  name: string;

  /** 插件描述 */
  description?: string;

  /** 插件版本 */
  version?: string;

  /** 插件注册的命令列表（用于帮助菜单展示） */
  commands?: PluginCommand[];

  /**
   * 事件处理优先级
   * 数字越小越先执行，默认 100
   * 可按事件类型分别设置
   */
  priority?: PluginPriority;

  /**
   * 插件加载时调用（仅在首次加载和热重载时触发）
   * @param ctx - 插件上下文
   */
  onLoad?(ctx: PluginContext): void | Promise<void>;

  /**
   * 插件卸载时调用（热重载或删除时触发）
   */
  onUnload?(): void | Promise<void>;

  /**
   * 插件启用时调用（首次加载后 + 从停用恢复时触发）
   * @param ctx - 插件上下文
   */
  onEnable?(ctx: PluginContext): void | Promise<void>;

  /**
   * 插件停用时调用
   * @param ctx - 插件上下文
   */
  onDisable?(ctx: PluginContext): void | Promise<void>;

  /**
   * 收到消息时调用（仅启用状态触发）
   * @param event - 消息事件
   * @param ctx - 插件上下文
   * @param emitCtx - 事件发射上下文（可调用 stopPropagation 阻止后续插件处理）
   */
  onMessage?(event: MessageEvent, ctx: PluginContext, emitCtx?: EmitEventContext<MessageEvent>): void | Promise<void>;

  /**
   * 收到通知时调用（仅启用状态触发）
   * @param event - 通知事件
   * @param ctx - 插件上下文
   * @param emitCtx - 事件发射上下文
   */
  onNotice?(event: NoticeEvent, ctx: PluginContext, emitCtx?: EmitEventContext<NoticeEvent>): void | Promise<void>;

  /**
   * 收到请求时调用（仅启用状态触发）
   * @param event - 请求事件
   * @param ctx - 插件上下文
   * @param emitCtx - 事件发射上下文
   */
  onRequest?(event: RequestEvent, ctx: PluginContext, emitCtx?: EmitEventContext<RequestEvent>): void | Promise<void>;
}

/**
 * 插件模块导出格式
 * 插件的 index.ts 需要 default export 一个 Plugin 对象
 */
export interface PluginModule {
  default: Plugin;
}
