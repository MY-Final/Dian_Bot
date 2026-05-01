# Dian_Bot 开发规范（v2 Runtime 架构版）

## 项目定位

Dian_Bot 是一个**基于 NapCat 的 Bot Runtime（运行时平台）**，而不是单一机器人逻辑项目。

它具备：

- 多 QQ Bot 实例管理
- 事件驱动架构
- 插件化运行系统
- 可扩展业务能力（Plugin SDK）
- 管理后台（外部系统）

## 系统架构

```
NapCat WS
    ↓
Adapter Layer（协议适配）
    ↓
Bot Core Runtime
    ├── Event Bus（事件总线）
    ├── Bot Instance Manager（多实例）
    ├── Plugin Manager（插件系统）
    ├── Context Runtime（运行上下文）
    └── Bot API（能力封装）
    ↓
Plugins（业务逻辑）
    ↓
Service Layer（可选）
    ↓
Storage Layer（Redis / PostgreSQL）
```

## 核心设计原则

### 1. 插件优先（Plugin First）

所有业务逻辑**必须**在插件中实现。

| 禁止 | 正确 |
|------|------|
| 在 adapter 写业务逻辑 | `ctx.api.sendGroupMsg(...)` |
| 在 handler 写核心逻辑 | 通过 PluginContext 操作 |
| plugin 直接操作 WebSocket / Redis | — |

### 2. 事件驱动（Event Driven）

所有消息必须经过 EventBus：

```
NapCat → Adapter → EventBus → Plugins
```

事件类型统一：

- `message`
- `notice`
- `request`
- `meta_event`

### 3. 多实例隔离（Multi-Bot Isolation）

每个 bot 实例必须完全隔离：

```typescript
interface BotInstance {
  botId: string;
  ws: WebSocket;
  state: ConnectionState;
  plugins: Plugin[];
}
```

禁止跨实例共享状态（除共享缓存层 Redis）。

### 4. 能力封装（API Boundary）

插件禁止直接访问底层资源：

| 不允许 | 必须通过 |
|--------|----------|
| `ws.send` | `ctx.api` |
| `redis.get` | `ctx.cache` |
| `database.query` | `ctx.db` |

## 目录结构

```
src/
├── core/
│   ├── BotManager.ts          # 多实例管理
│   ├── BotClient.ts           # 单 bot 实例
│   └── Runtime.ts             # 运行时入口
│
├── adapter/
│   └── napcat.ts              # WS 协议适配
│
├── event/
│   ├── EventBus.ts            # 事件总线
│   └── EventTypes.ts          # 事件类型定义
│
├── plugin/
│   ├── PluginManager.ts       # 插件管理
│   ├── PluginLoader.ts        # 动态加载
│   ├── context.ts             # PluginContext
│   └── types.ts               # Plugin 接口
│
├── api/
│   └── server.ts              # 给 dashboard 用
│
├── services/
│   └── BotAPI.ts              # 能力封装层
│
├── state/
│   ├── redis.ts               # Redis 连接
│   └── memory.ts              # 内存状态
│
├── db/
│   └── prisma.ts              # 数据库连接
│
└── index.ts                   # 入口文件
```

## 插件系统规范

### Plugin 接口

```typescript
export interface Plugin {
  name: string;

  onLoad?(ctx: PluginContext): void;
  onUnload?(): void;

  onMessage?(ctx: PluginContext): void;
  onNotice?(ctx: PluginContext): void;
}
```

### PluginContext

```typescript
export interface PluginContext {
  botId: string;
  groupId?: number;
  userId?: number;
  message: any;

  api: BotAPI;        // 发送消息等能力
  cache: CacheAPI;    // Redis 封装
  db: DatabaseAPI;    // 数据库封装
  logger: Logger;
}
```

### 生命周期

```
load → enable → runtime → disable → unload
```

### 插件目录结构

```
plugins/
  welcome/
    index.ts
  stats/
    index.ts
```

## 消息处理流程

```
NapCat WS
   ↓
Adapter（协议解析）
   ↓
BotClient（实例路由）
   ↓
EventBus（统一事件）
   ↓
PluginManager（分发）
   ↓
Plugin.onMessage(ctx)
```

## Adapter 规范（NapCat）

### 必须职责

- WS 连接
- 自动重连
- 心跳处理
- JSON 解析
- 原始事件标准化

### 禁止职责

- 不写业务逻辑
- 不操作插件
- 不访问数据库

## BotClient（单实例规范）

每个 BotClient 必须包含：

```typescript
class BotClient {
  botId: string;
  ws: WebSocket;
  state: ConnectionState;
  pluginManager: PluginManager;
  eventBus: EventBus;
}
```

职责：

- 接收 adapter 数据
- 转换为 event
- 派发给 pluginManager

## EventBus 规范

事件必须统一为以下类型：

```typescript
type EventType =
  | "message"
  | "notice"
  | "request"
  | "meta";
```

**禁止**直接传 raw ws 数据到 plugin。

## Bot API 规范

插件只能通过 API 操作机器人：

```typescript
sendGroupMsg(groupId: number, text: string): Promise<void>;
muteMember(groupId: number, userId: number, duration: number): Promise<void>;
getGroupInfo(groupId: number): Promise<GroupInfo>;
```

## 状态层规范

### Redis（实时）

- 计数
- 限流
- Session
- 临时上下文

### PostgreSQL（持久）

- Bot 配置
- 插件配置
- 用户数据
- 日志

## 日志规范

```
[Adapter] connected
[BotClient:123] message received
[Plugin:welcome] executed
```

## 禁止事项

- plugin 直接使用 ws
- plugin 直接访问 redis
- adapter 写业务逻辑
- handler 层写核心逻辑
- 跨 bot instance 共享内存状态

## 推荐技术栈

- Node.js v20+
- TypeScript（strict mode）
- ws
- ioredis
- PostgreSQL + Prisma
- Fastify（API 层）

## 设计目标

系统最终必须满足：

- 插件可独立开发
- 插件不依赖 core 实现
- 支持多 bot 实例
- 支持动态扩展能力
- core 不被业务污染
