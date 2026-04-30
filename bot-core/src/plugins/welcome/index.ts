import type { Plugin } from "../../plugin/types.js";
import type { PluginContext } from "../../plugin/context.js";
import type { MessageEvent, GroupMessageEvent } from "../../event/EventTypes.js";

/**
 * Welcome 插件示例
 * 新成员入群时发送欢迎消息
 */
const plugin: Plugin = {
  name: "welcome",
  description: "新成员入群欢迎插件",
  version: "1.0.0",

  onLoad(ctx: PluginContext) {
    ctx.logger.log("Welcome 插件已加载");
  },

  async onMessage(event: MessageEvent, ctx: PluginContext) {
    // 只处理群消息
    if (event.message_type !== "group") return;

    const groupEvent = event as GroupMessageEvent;
    const rawMsg = event.raw_message;

    // 简单的命令响应示例
    if (rawMsg === "/ping") {
      await ctx.api.sendGroupMsg(groupEvent.group_id, "pong!");
      ctx.logger.log(`响应 /ping: 群=${groupEvent.group_id}, 用户=${event.user_id}`);
    }

    if (rawMsg === "/info") {
      const info = await ctx.api.getLoginInfo();
      if (info.status === "ok") {
        await ctx.api.sendGroupMsg(
          groupEvent.group_id,
          `Bot: ${info.data.nickname} (${info.data.user_id})`
        );
      }
    }
  },

  onUnload() {
    console.log("[Plugin:welcome] 已卸载");
  },
};

export default plugin;
