import WebSocket from "ws";

/**
 * NapCat 连接配置
 */
export interface NapCatConfig {
  /** WebSocket 地址，例如 ws://192.168.2.14:13001 */
  url: string;
  /** 认证 Token */
  token: string;
}

/**
 * NapCat 适配器
 * 通过 WebSocket 连接 NapCat，接收和发送 QQ 消息
 */
export class NapCatAdapter {
  private ws!: WebSocket;
  private config!: NapCatConfig;

  /**
   * 连接到 NapCat WebSocket 服务
   * @param config - 连接配置（地址 + Token）
   */
  connect(config: NapCatConfig) {
    this.config = config;

    this.ws = new WebSocket(config.url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    });

    // 连接成功
    this.ws.on("open", () => {
      console.log("[NapCat] connected to", config.url);
    });

    // 收到消息
    this.ws.on("message", (data) => {
      const msg = data.toString();
      console.log("[NapCat raw]", msg);
      // TODO: 解析消息并分发到业务逻辑
    });

    // 连接关闭
    this.ws.on("close", () => {
      console.log("[NapCat] disconnected");
      // TODO: 可在此处添加自动重连逻辑
    });

    // 连接错误
    this.ws.on("error", (err) => {
      console.error("[NapCat] error:", err.message);
    });
  }

  /**
   * 发送消息到 NapCat
   * @param data - 要发送的数据（对象会自动序列化为 JSON）
   */
  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("[NapCat] 未连接，无法发送消息");
    }
  }
}
