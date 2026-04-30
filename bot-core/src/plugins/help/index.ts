import type { Plugin } from "../../plugin/types.js";
import type { PluginContext } from "../../plugin/context.js";
import type { MessageEvent, GroupMessageEvent } from "../../event/EventTypes.js";

/**
 * Help 插件
 * - "帮助"/"菜单"：显示所有启用插件的命令
 * - "插件列表"：显示所有插件及状态
 * - "启用 [插件名]"：启用指定插件
 * - "停用 [插件名]"：停用指定插件
 */
const plugin: Plugin = {
  name: "help",
  description: "帮助菜单与插件管理",
  version: "1.0.0",

  commands: [
    { command: "帮助", description: "显示所有可用命令", usage: "帮助" },
    { command: "菜单", description: "显示所有可用命令", usage: "菜单" },
    { command: "插件列表", description: "查看所有插件及状态", usage: "插件列表" },
    { command: "启用", description: "启用指定插件", usage: "启用 [插件名]" },
    { command: "停用", description: "停用指定插件", usage: "停用 [插件名]" },
  ],

  onLoad(ctx) {
    ctx.logger.log("Help 插件已加载");
  },

  async onMessage(event: MessageEvent, ctx: PluginContext) {
    if (event.message_type !== "group") return;

    const groupEvent = event as GroupMessageEvent;
    const groupId = groupEvent.group_id;
    const rawMsg = event.raw_message.trim();

    // ---- 帮助菜单 ----
    if (rawMsg === "帮助" || rawMsg === "菜单") {
      const commands = ctx.getAllCommands();

      if (commands.length === 0) {
        await ctx.api.sendGroupMsg(groupId, "暂无可用命令");
        return;
      }

      // 按插件名分组
      const grouped = new Map<string, typeof commands>();
      for (const cmd of commands) {
        const list = grouped.get(cmd.pluginName) ?? [];
        list.push(cmd);
        grouped.set(cmd.pluginName, list);
      }

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

      await ctx.api.sendGroupMsg(groupId, lines.join("\n"));
      return;
    }

    // ---- 插件列表 ----
    if (rawMsg === "插件列表") {
      const infos = ctx.control.getAllPluginInfos();

      if (infos.length === 0) {
        await ctx.api.sendGroupMsg(groupId, "暂无已注册插件");
        return;
      }

      const lines: string[] = ["=== 插件列表 ===", ""];
      for (const info of infos) {
        const statusIcon = info.status === "enabled" ? "✅" : "❌";
        const desc = info.description ? ` - ${info.description}` : "";
        const ver = info.version ? ` v${info.version}` : "";
        lines.push(`${statusIcon} ${info.name}${ver}${desc}`);
      }
      lines.push("");
      lines.push('发送 "启用/停用 [插件名]" 切换状态');

      await ctx.api.sendGroupMsg(groupId, lines.join("\n"));
      return;
    }

    // ---- 启用插件 ----
    if (rawMsg.startsWith("启用 ")) {
      const pluginName = rawMsg.slice(3).trim();
      if (!pluginName) {
        await ctx.api.sendGroupMsg(groupId, "用法: 启用 [插件名]");
        return;
      }

      const success = await ctx.control.enable(pluginName);
      if (success) {
        await ctx.api.sendGroupMsg(groupId, `插件 "${pluginName}" 已启用`);
      } else {
        await ctx.api.sendGroupMsg(groupId, `插件 "${pluginName}" 不存在`);
      }
      return;
    }

    // ---- 停用插件 ----
    if (rawMsg.startsWith("停用 ")) {
      const pluginName = rawMsg.slice(3).trim();
      if (!pluginName) {
        await ctx.api.sendGroupMsg(groupId, "用法: 停用 [插件名]");
        return;
      }

      // 禁止停用自己（help 插件）
      if (pluginName === "help") {
        await ctx.api.sendGroupMsg(groupId, "不能停用 help 插件");
        return;
      }

      const success = await ctx.control.disable(pluginName);
      if (success) {
        await ctx.api.sendGroupMsg(groupId, `插件 "${pluginName}" 已停用`);
      } else {
        await ctx.api.sendGroupMsg(groupId, `插件 "${pluginName}" 不存在`);
      }
      return;
    }
  },

  onUnload() {
    console.log("[Plugin:help] 已卸载");
  },
};

export default plugin;
