import { NapCatAdapter } from "./adapter/napcat.js";

console.log("bot-core starting...");

const adapter = new NapCatAdapter();

// 连接到 NapCat WebSocket 服务
adapter.connect({
  url: "ws://192.168.2.14:13001",
  token: "lxy666666.@",
});
