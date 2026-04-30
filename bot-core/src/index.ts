import { Runtime } from "./core/Runtime.js";

console.log("bot-core starting...");

const runtime = new Runtime({
  bots: [
    {
      botId: "main",
      ws: {
        url: "ws://192.168.2.14:13001",
        token: "lxy666666.@",
      },
      api: {
        baseUrl: "http://192.168.2.14:13000",
        token: "IBC39ocS1ceznq87",
      },
    },
  ],
});

// 优雅退出
process.on("SIGINT", () => {
  console.log("\n收到 SIGINT，正在关闭...");
  runtime.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n收到 SIGTERM，正在关闭...");
  runtime.stop();
  process.exit(0);
});

runtime.start();
