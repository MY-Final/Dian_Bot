import { EventEmitter } from "events";
import type { BotEvent, MessageEvent, NoticeEvent, RequestEvent, MetaEvent } from "../event/EventTypes.js";
import { EventBus } from "../event/EventBus.js";
import { NapCatAdapter, type NapCatConfig } from "../adapter/napcat.js";
import { BotAPI, type BotAPIConfig } from "../services/BotAPI.js";

/** Bot 连接状态 */
export type ConnectionState = "disconnected" | "connecting" | "connected";

/** BotClient 配置 */
export interface BotClientConfig {
  /** Bot 唯一标识 */
  botId: string;
  /** NapCat WebSocket 配置 */
  ws: NapCatConfig;
  /** NapCat HTTP API 配置 */
  api: BotAPIConfig;
}

/**
 * 单 Bot 实例
 * 管理一个 Bot 的 adapter、事件总线和 API
 */
export class BotClient {
  /** Bot 唯一标识 */
  readonly botId: string;

  /** WebSocket 适配器 */
  readonly adapter: NapCatAdapter;

  /** 事件总线 */
  readonly eventBus: EventBus;

  /** API 能力层 */
  readonly api: BotAPI;

  /** 连接状态 */
  private state: ConnectionState = "disconnected";

  constructor(config: BotClientConfig) {
    this.botId = config.botId;
    this.adapter = new NapCatAdapter(config.ws);
    this.eventBus = new EventBus();
    this.api = new BotAPI(config.api);
  }

  /**
   * 启动 Bot
   * 连接 WebSocket 并开始接收事件
   */
  start(): void {
    if (this.state !== "disconnected") {
      console.warn(`[BotClient:${this.botId}] 已在运行中，state=${this.state}`);
      return;
    }

    this.state = "connecting";
    console.log(`[BotClient:${this.botId}] 正在连接...`);

    // 注册 adapter 事件回调
    this.adapter.onMessage((raw: string) => {
      this.handleRawMessage(raw);
    });

    this.adapter.onOpen(() => {
      this.state = "connected";
      console.log(`[BotClient:${this.botId}] 已连接`);
    });

    this.adapter.onClose(() => {
      this.state = "disconnected";
      console.log(`[BotClient:${this.botId}] 已断开`);
    });

    this.adapter.onError((err: Error) => {
      console.error(`[BotClient:${this.botId}] 错误:`, err.message);
    });

    // 连接
    this.adapter.connect();
  }

  /**
   * 停止 Bot
   */
  stop(): void {
    this.adapter.disconnect();
    this.state = "disconnected";
    this.eventBus.clear();
    console.log(`[BotClient:${this.botId}] 已停止`);
  }

  /**
   * 获取当前连接状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 处理原始 WebSocket 消息
   * 解析 JSON 并根据 post_type 分发到事件总线
   */
  private handleRawMessage(raw: string): void {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      console.warn(`[BotClient:${this.botId}] 无法解析消息:`, raw.slice(0, 100));
      return;
    }

    // NapCat API 响应（有 echo 字段）跳过
    if ("echo" in data) {
      return;
    }

    // 必须有 post_type 才是事件
    if (!("post_type" in data)) {
      return;
    }

    const event = data as unknown as BotEvent;
    console.log(`[BotClient:${this.botId}] 收到事件: ${event.post_type}`);

    // 分发到事件总线
    this.eventBus.dispatch(event);
  }
}
