import WebSocket from "ws";

/** NapCat 连接配置 */
export interface NapCatConfig {
  /** WebSocket 地址，例如 ws://192.168.2.14:13001 */
  url: string;
  /** 认证 Token */
  token: string;
  /** 自动重连间隔（毫秒），默认 5000 */
  reconnectInterval?: number;
}

/**
 * NapCat 适配器
 * 通过 WebSocket 连接 NapCat，接收和发送 QQ 消息
 * 仅负责连接管理和原始数据收发，不做业务处理
 */
export class NapCatAdapter {
  private ws!: WebSocket;
  private config: NapCatConfig;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  // 事件回调
  private messageHandler: ((data: string) => void) | null = null;
  private openHandler: (() => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private errorHandler: ((err: Error) => void) | null = null;

  constructor(config: NapCatConfig) {
    this.config = config;
  }

  /** 注册消息回调 */
  onMessage(handler: (data: string) => void): void {
    this.messageHandler = handler;
  }

  /** 注册连接成功回调 */
  onOpen(handler: () => void): void {
    this.openHandler = handler;
  }

  /** 注册连接关闭回调 */
  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  /** 注册错误回调 */
  onError(handler: (err: Error) => void): void {
    this.errorHandler = handler;
  }

  /**
   * 连接到 NapCat WebSocket 服务
   */
  connect(): void {
    this.shouldReconnect = true;

    this.ws = new WebSocket(this.config.url, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
      },
    });

    // 连接成功
    this.ws.on("open", () => {
      console.log("[NapCat] connected to", this.config.url);
      this.openHandler?.();
    });

    // 收到消息
    this.ws.on("message", (data) => {
      const msg = data.toString();
      this.messageHandler?.(msg);
    });

    // 连接关闭
    this.ws.on("close", () => {
      console.log("[NapCat] disconnected");
      this.closeHandler?.();
      this.scheduleReconnect();
    });

    // 连接错误
    this.ws.on("error", (err) => {
      console.error("[NapCat] error:", err.message);
      this.errorHandler?.(err);
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * 发送消息到 NapCat
   * @param data - 要发送的数据（对象会自动序列化为 JSON）
   */
  send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("[NapCat] 未连接，无法发送消息");
    }
  }

  /**
   * 安排自动重连
   */
  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;

    const interval = this.config.reconnectInterval ?? 5000;
    console.log(`[NapCat] ${interval}ms 后重连...`);
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, interval);
  }
}
