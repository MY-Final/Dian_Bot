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
  pluginsDir: "./src/plugins",
});

// 优雅退出
const shutdown = async () => {
  console.log("\n正在关闭...");
  await runtime.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// 启动
runtime.start().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
