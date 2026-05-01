import type { Plugin } from "../../plugin/types.js";
import type { PluginContext } from "../../plugin/context.js";
import type { MessageEvent, GroupMessageEvent } from "../../event/EventTypes.js";
import type { EmitEventContext } from "../../event/EventContext.js";

/**
 * Welcome 插件
 * 基础指令插件，演示插件系统核心功能
 */
const plugin: Plugin = {
  name: "welcome",
  description: "基础指令插件",
  version: "1.0.0",

  // 命令声明（用于帮助菜单）
  commands: [
    { command: "/ping", description: "测试 Bot 是否在线", usage: "/ping" },
    { command: "/info", description: "查看 Bot 登录信息", usage: "/info" },
    { command: "/冷却测试", description: "测试冷却功能", usage: "/冷却测试" },
  ],

  // 优先级：消息处理优先级 50（比默认 100 更早执行）
  priority: {
    message: 50,
  },

  async onLoad(ctx: PluginContext) {
    ctx.logger.log("Welcome 插件已加载");

    // 从配置读取欢迎语，不存在则写入默认值
    const greet = await ctx.config.get("greet", "欢迎使用 Dian_Bot!");
    await ctx.config.set("greet", greet);
    ctx.logger.log(`欢迎语: ${greet}`);
  },

  async onMessage(event: MessageEvent, ctx: PluginContext, emitCtx?: EmitEventContext<MessageEvent>) {
    if (event.message_type !== "group") return;

    const groupEvent = event as GroupMessageEvent;
    const groupId = groupEvent.group_id;
    const rawMsg = event.raw_message.trim();

    // /ping
    if (rawMsg === "/ping") {
      await ctx.api.sendGroupMsg(groupId, "pong!");
      // 调用 stopPropagation 阻止后续插件处理这条消息
      emitCtx?.stopPropagation("welcome");
      return;
    }

    // /info
    if (rawMsg === "/info") {
      const info = await ctx.api.getLoginInfo();
      if (info.status === "ok") {
        await ctx.api.sendGroupMsg(groupId, `Bot: ${info.data.nickname} (${info.data.user_id})`);
      }
      emitCtx?.stopPropagation("welcome");
      return;
    }

    // /冷却测试 - 演示冷却功能
    if (rawMsg === "/冷却测试") {
      // 检查冷却（5秒）
      if (ctx.cooldown.check(event.user_id)) {
        const remaining = ctx.cooldown.remaining(event.user_id);
        await ctx.api.sendGroupMsg(groupId, `冷却中，还需等待 ${remaining} 秒`);
        return;
      }

      // 设置冷却
      ctx.cooldown.set(event.user_id, 5);
      await ctx.api.sendGroupMsg(groupId, "冷却测试成功！5秒内不能再次使用");

      // 写入存储（记录调用次数）
      const count = (await ctx.store.get<number>("ping_count")) ?? 0;
      await ctx.store.set("ping_count", count + 1);

      emitCtx?.stopPropagation("welcome");
      return;
    }
  },

  onUnload() {
    console.log("[Plugin:welcome] 已卸载");
  },
};

export default plugin;
