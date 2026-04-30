import type { MessageEvent, NoticeEvent, RequestEvent } from "../event/EventTypes.js";
import type { PluginContext } from "./context.js";

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
   * 插件加载时调用
   * @param ctx - 插件上下文
   */
  onLoad?(ctx: PluginContext): void | Promise<void>;

  /**
   * 插件卸载时调用
   */
  onUnload?(): void | Promise<void>;

  /**
   * 收到消息时调用
   * @param event - 消息事件
   * @param ctx - 插件上下文
   */
  onMessage?(event: MessageEvent, ctx: PluginContext): void | Promise<void>;

  /**
   * 收到通知时调用
   * @param event - 通知事件
   * @param ctx - 插件上下文
   */
  onNotice?(event: NoticeEvent, ctx: PluginContext): void | Promise<void>;

  /**
   * 收到请求时调用
   * @param event - 请求事件
   * @param ctx - 插件上下文
   */
  onRequest?(event: RequestEvent, ctx: PluginContext): void | Promise<void>;
}

/**
 * 插件模块导出格式
 * 插件的 index.ts 需要 default export 一个 Plugin 对象
 */
export interface PluginModule {
  default: Plugin;
}
