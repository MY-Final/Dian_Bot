import type { Plugin } from "../../plugin/types.js";
import type { PluginContext } from "../../plugin/context.js";
import type { MessageEvent, GroupMessageEvent } from "../../event/EventTypes.js";

/**
 * Help 插件
 * 当用户发送"帮助"或"菜单"时，列出所有插件注册的命令
 */
const plugin: Plugin = {
  name: "help",
  description: "帮助菜单插件",
  version: "1.0.0",

  commands: [
    { command: "帮助", description: "显示所有可用命令", usage: "帮助" },
    { command: "菜单", description: "显示所有可用命令", usage: "菜单" },
  ],

  onLoad(ctx) {
    ctx.logger.log("Help 插件已加载");
  },

  async onMessage(event: MessageEvent, ctx: PluginContext) {
    // 只处理群消息
    if (event.message_type !== "group") return;

    const groupEvent = event as GroupMessageEvent;
    const rawMsg = event.raw_message.trim();

    // 匹配触发词
    if (rawMsg !== "帮助" && rawMsg !== "菜单") return;

    // 获取所有命令
    const commands = ctx.getAllCommands();

    if (commands.length === 0) {
      await ctx.api.sendGroupMsg(groupEvent.group_id, "暂无可用命令");
      return;
    }

    // 按插件名分组
    const grouped = new Map<string, typeof commands>();
    for (const cmd of commands) {
      const list = grouped.get(cmd.pluginName) ?? [];
      list.push(cmd);
      grouped.set(cmd.pluginName, list);
    }

    // 格式化输出
    const lines: string[] = ["=== 帮助菜单 ===", ""];
    for (const [pluginName, cmds] of grouped) {
      lines.push(`【${pluginName}】`);
      for (const cmd of cmds) {
        const usage = cmd.usage ? `  用法: ${cmd.usage}` : "";
        lines.push(`  ${cmd.command} - ${cmd.description}${usage}`);
      }
      lines.push("");
    }
    lines.push("输入对应指令即可使用");

    await ctx.api.sendGroupMsg(groupEvent.group_id, lines.join("\n"));
    ctx.logger.log(`帮助菜单: 群=${groupEvent.group_id}`);
  },

  onUnload() {
    console.log("[Plugin:help] 已卸载");
  },
};

export default plugin;
