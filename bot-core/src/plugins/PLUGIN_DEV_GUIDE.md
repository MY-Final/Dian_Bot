# Dian_Bot 插件开发指南

## 快速开始

### 目录结构

在 `src/plugins/` 下创建以插件名命名的目录，包含 `index.ts` 入口文件：

```
src/plugins/
  my-plugin/
    index.ts          # 入口文件（必须）
    config.json       # 配置文件（自动生成）
    data.json         # 持久化数据（自动生成）
```

### 最小示例

```typescript
// src/plugins/my-plugin/index.ts
import type { Plugin } from "../../plugin/types.js";
import type { PluginContext } from "../../plugin/context.js";

const plugin: Plugin = {
  name: "my-plugin",
  description: "我的插件",
  version: "1.0.0",

  onLoad(ctx) {
    ctx.logger.log("插件已加载");
  },

  async onMessage(event, ctx) {
    if (event.raw_message === "你好") {
      if (event.message_type === "group") {
        await ctx.api.sendGroupMsg(event.group_id, "你好！");
      }
    }
  },
};

export default plugin;
```

---

## Plugin 接口

```typescript
interface Plugin {
  name: string;                    // 唯一标识（必须）
  description?: string;            // 描述
  version?: string;                // 版本号
  commands?: PluginCommand[];      // 命令声明（用于帮助菜单）
  priority?: PluginPriority;       // 事件处理优先级

  // 生命周期
  onLoad?(ctx: PluginContext): void | Promise<void>;
  onUnload?(): void | Promise<void>;
  onEnable?(ctx: PluginContext): void | Promise<void>;
  onDisable?(ctx: PluginContext): void | Promise<void>;

  // 事件处理
  onMessage?(event: MessageEvent, ctx: PluginContext, emitCtx?: EmitEventContext): void | Promise<void>;
  onNotice?(event: NoticeEvent, ctx: PluginContext, emitCtx?: EmitEventContext): void | Promise<void>;
  onRequest?(event: RequestEvent, ctx: PluginContext, emitCtx?: EmitEventContext): void | Promise<void>;
}
```

### 生命周期

```
加载 → 启用 → 运行中 → 停用 → 卸载
         ↑              ↓
         └── 重新启用 ──┘

热重载：卸载旧实例 → 加载新实例 → 启用（保留原状态）
```

- `onLoad` — 首次加载和热重载时触发，适合读取配置、初始化
- `onEnable` — 首次加载后 + 从停用恢复时触发，适合注册定时任务
- `onDisable` — 停用时触发，适合清理资源
- `onUnload` — 热重载或删除时触发，适合最终清理

---

## PluginContext 能力

### ctx.api — Bot API

```typescript
// 发送消息
await ctx.api.sendGroupMsg(groupId, "消息内容");
await ctx.api.sendPrivateMsg(userId, "私聊消息");
await ctx.api.sendMsg("group", groupId, undefined, "消息");

// 消息管理
await ctx.api.deleteMsg(messageId);
await ctx.api.getMsg(messageId);

// 群管理
await ctx.api.getGroupInfo(groupId);
await ctx.api.getGroupList();
await ctx.api.getGroupMemberList(groupId);
await ctx.api.setGroupBan(groupId, userId, duration);
await ctx.api.setGroupCard(groupId, userId, "新名片");
await ctx.api.setGroupKick(groupId, userId);

// 好友管理
await ctx.api.getFriendList();
await ctx.api.getStrangerInfo(userId);
await ctx.api.setFriendAddRequest(flag, approve, remark);
await ctx.api.setGroupAddRequest(flag, subType, approve, reason);

// 其他
await ctx.api.sendPoke(userId, groupId);
await ctx.api.getLoginInfo();
await ctx.api.sendLike(userId, times);
```

### ctx.config — 插件配置

持久化配置，存储在 `plugins/<name>/config.json`。

```typescript
// 读取配置（带默认值）
const greet = await ctx.config.get("greet", "默认欢迎语");

// 写入配置
await ctx.config.set("greet", "新的欢迎语");

// 检查和删除
if (await ctx.config.has("key")) {
  await ctx.config.delete("key");
}
```

### ctx.cooldown — 冷却限流

```typescript
// 检查冷却
if (ctx.cooldown.check(userId)) {
  const remaining = ctx.cooldown.remaining(userId);
  await ctx.api.sendGroupMsg(groupId, `冷却中，还需 ${remaining} 秒`);
  return;
}

// 设置 5 秒冷却
ctx.cooldown.set(userId, 5);

// 清除冷却
ctx.cooldown.clear(userId);
```

### ctx.store — 持久化存储

Key-Value 存储，数据在 `plugins/<name>/data.json`。

```typescript
// 读写数据
const count = (await ctx.store.get<number>("count")) ?? 0;
await ctx.store.set("count", count + 1);

// 其他操作
await ctx.store.has("key");
await ctx.store.delete("key");
const keys = await ctx.store.keys();
await ctx.store.clear();
```

### ctx.scheduler — 定时任务

插件卸载时自动清理所有定时任务。

```typescript
// 延迟执行（返回取消函数）
const cancel = ctx.scheduler.setTimeout(() => {
  ctx.logger.log("3秒后执行");
}, 3000);
cancel(); // 取消

// 间隔执行
const stop = ctx.scheduler.setInterval(() => {
  ctx.logger.log("每 60 秒执行一次");
}, 60000);
stop(); // 停止
```

### ctx.bus — 插件间通信

```typescript
// 监听其他插件发来的事件
ctx.bus.on("score-updated", (data) => {
  ctx.logger.log("收到积分更新:", data);
});

// 发送事件给其他插件
ctx.bus.emit("score-updated", { userId: 123, score: 100 });

// 只监听一次
ctx.bus.once("ready", () => { /* ... */ });
```

### ctx.control — 插件管理

```typescript
// 启用/停用其他插件
await ctx.control.enable("other-plugin");
await ctx.control.disable("other-plugin");
await ctx.control.toggle("other-plugin");

// 查询状态
const status = ctx.control.getStatus("other-plugin"); // "enabled" | "disabled"

// 获取所有插件信息
const infos = ctx.control.getAllPluginInfos();
```

### ctx.logger — 日志

自动带 `[Plugin:插件名]` 前缀。

```typescript
ctx.logger.log("普通日志");
ctx.logger.warn("警告");
ctx.logger.error("错误");
```

---

## 命令声明

在 `commands` 中声明命令，帮助菜单会自动展示：

```typescript
const plugin: Plugin = {
  name: "my-plugin",
  commands: [
    { command: "签到", description: "每日签到", usage: "签到" },
    { command: "积分", description: "查看积分", usage: "积分" },
  ],
  // ...
};
```

---

## 优先级控制

数字越小越先执行，默认 100。

```typescript
const plugin: Plugin = {
  name: "my-plugin",
  priority: {
    message: 50,   // 消息处理优先级
    notice: 100,   // 通知处理优先级
    request: 100,  // 请求处理优先级
  },
  // ...
};
```

| 优先级 | 用途 |
|--------|------|
| 0-9 | 安全/鉴权（限流、权限） |
| 10-49 | 前置中间件（日志、验证） |
| 50 | 默认，普通插件 |
| 51-89 | 后置中间件 |
| 90-100 | 兜底/默认回复 |

---

## 事件拦截

使用 `emitCtx.stopPropagation()` 阻止后续插件处理：

```typescript
async onMessage(event, ctx, emitCtx) {
  if (event.raw_message === "/ping") {
    await ctx.api.sendGroupMsg(event.group_id, "pong!");
    emitCtx?.stopPropagation("my-plugin"); // 后续插件不会收到这条消息
  }
}
```

---

## 无空格命令解析

使用 `parseCommand` 工具：

```typescript
import { parseCommand, matchCommand } from "../../utils/command.js";

// 支持有空格和无空格
const parsed = parseCommand("启用welcome", ["启用", "停用"]);
// → { command: "启用", args: "welcome" }

const parsed2 = parseCommand("启用 welcome", ["启用", "停用"]);
// → { command: "启用", args: "welcome" }

// 纯匹配
if (matchCommand(rawMsg, "帮助")) {
  // 处理帮助命令
}
```

---

## 完整示例

```typescript
import type { Plugin } from "../../plugin/types.js";
import type { PluginContext } from "../../plugin/context.js";
import type { MessageEvent, GroupMessageEvent } from "../../event/EventTypes.js";
import type { EmitEventContext } from "../../event/EventContext.js";
import { parseCommand } from "../../utils/command.js";

const plugin: Plugin = {
  name: "sign",
  description: "每日签到插件",
  version: "1.0.0",

  commands: [
    { command: "签到", description: "每日签到获取积分", usage: "签到" },
    { command: "积分", description: "查看当前积分", usage: "积分" },
  ],

  priority: { message: 50 },

  async onLoad(ctx) {
    // 读取配置
    const reward = await ctx.config.get("reward", 10);
    ctx.logger.log(`签到奖励: ${reward} 积分`);
  },

  async onMessage(event: MessageEvent, ctx: PluginContext, emitCtx?: EmitEventContext) {
    if (event.message_type !== "group") return;
    const groupId = (event as GroupMessageEvent).group_id;
    const userId = event.user_id;
    const rawMsg = event.raw_message.trim();

    // 签到
    if (rawMsg === "签到") {
      // 冷却检查（24小时）
      if (ctx.cooldown.check(userId)) {
        const h = Math.ceil(ctx.cooldown.remaining(userId) / 3600);
        await ctx.api.sendGroupMsg(groupId, `你已经签到过了，${h}小时后再来`);
        emitCtx?.stopPropagation("sign");
        return;
      }

      // 读取配置的奖励
      const reward = await ctx.config.get("reward", 10);

      // 获取并更新积分
      const key = `score:${userId}`;
      const score = (await ctx.store.get<number>(key)) ?? 0;
      await ctx.store.set(key, score + reward);

      // 设置24小时冷却
      ctx.cooldown.set(userId, 86400);

      await ctx.api.sendGroupMsg(groupId, `签到成功！获得 ${reward} 积分，当前积分: ${score + reward}`);
      emitCtx?.stopPropagation("sign");
      return;
    }

    // 查积分
    if (rawMsg === "积分") {
      const key = `score:${userId}`;
      const score = (await ctx.store.get<number>(key)) ?? 0;
      await ctx.api.sendGroupMsg(groupId, `当前积分: ${score}`);
      emitCtx?.stopPropagation("sign");
      return;
    }
  },
};

export default plugin;
```

---

## 热重载

插件支持运行时热重载，无需重启 Bot：

1. **新增插件**：在 `plugins/` 下创建新目录，自动加载
2. **修改插件**：保存文件后自动重新加载（保留原启用/停用状态）
3. **删除插件**：删除目录后自动卸载

---

## 插件管理

用户可通过群聊命令管理插件：

```
帮助         → 显示所有命令
插件列表     → 显示所有插件及状态
启用[插件名] → 启用插件
停用[插件名] → 停用插件
```
