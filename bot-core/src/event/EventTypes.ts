/**
 * 事件类型定义
 * 基于 OneBot v11 协议规范
 */

// ==================== 基础类型 ====================

/** post_type 枚举 */
export type PostType = "message" | "notice" | "request" | "meta_event";

/** 消息类型 */
export type MessageType = "private" | "group";

/** 消息子类型 */
export type MessageSubType = "friend" | "normal" | "anonymous" | "group" | "other";

/** 群成员角色 */
export type GroupMemberRole = "owner" | "admin" | "member";

/** 性别 */
export type UserSex = "male" | "female" | "unknown";

// ==================== 消息段类型 ====================

/** 文本消息段 */
export interface TextSegment {
  type: "text";
  data: { text: string };
}

/** @消息段 */
export interface AtSegment {
  type: "at";
  data: { qq: string; name?: string };
}

/** 图片消息段 */
export interface ImageSegment {
  type: "image";
  data: {
    file: string;
    url?: string;
    sub_type?: number;
    thumb?: string;
    name?: string;
  };
}

/** 回复消息段 */
export interface ReplySegment {
  type: "reply";
  data: { id: string };
}

/** 表情消息段 */
export interface FaceSegment {
  type: "face";
  data: { id: string };
}

/** 语音消息段 */
export interface RecordSegment {
  type: "record";
  data: { file: string; url?: string };
}

/** 视频消息段 */
export interface VideoSegment {
  type: "video";
  data: { file: string; url?: string };
}

/** 合并转发消息段 */
export interface ForwardSegment {
  type: "forward";
  data: { id: string };
}

/** JSON 消息段 */
export interface JsonSegment {
  type: "json";
  data: { data: string };
}

/** 戳一戳消息段 */
export interface PokeSegment {
  type: "poke";
  data: { type: string; id: string };
}

/** 消息段联合类型 */
export type MessageSegment =
  | TextSegment
  | AtSegment
  | ImageSegment
  | ReplySegment
  | FaceSegment
  | RecordSegment
  | VideoSegment
  | ForwardSegment
  | JsonSegment
  | PokeSegment;

// ==================== Sender ====================

/** 发送者信息 */
export interface Sender {
  user_id: number;
  nickname: string;
  card?: string;
  sex?: UserSex;
  age?: number;
  area?: string;
  level?: string;
  role?: GroupMemberRole;
  title?: string;
}

// ==================== 消息事件 ====================

/** 私聊消息事件 */
export interface PrivateMessageEvent {
  post_type: "message";
  message_type: "private";
  sub_type: MessageSubType;
  message_id: number;
  user_id: number;
  message: MessageSegment[];
  raw_message: string;
  sender: Sender;
  time: number;
  self_id: number;
}

/** 群消息事件 */
export interface GroupMessageEvent {
  post_type: "message";
  message_type: "group";
  sub_type: MessageSubType;
  message_id: number;
  user_id: number;
  group_id: number;
  message: MessageSegment[];
  raw_message: string;
  sender: Sender;
  time: number;
  self_id: number;
}

/** 消息事件联合类型 */
export type MessageEvent = PrivateMessageEvent | GroupMessageEvent;

// ==================== 通知事件 ====================

/** 群成员增加 */
export interface GroupIncreaseEvent {
  post_type: "notice";
  notice_type: "group_increase";
  sub_type: "approve" | "invite";
  group_id: number;
  user_id: number;
  operator_id: number;
  self_id: number;
  time: number;
}

/** 群成员减少 */
export interface GroupDecreaseEvent {
  post_type: "notice";
  notice_type: "group_decrease";
  sub_type: "leave" | "kick" | "kick_me";
  group_id: number;
  user_id: number;
  operator_id: number;
  self_id: number;
  time: number;
}

/** 群禁言 */
export interface GroupBanEvent {
  post_type: "notice";
  notice_type: "group_ban";
  sub_type: "ban" | "lift_ban";
  group_id: number;
  user_id: number;
  operator_id: number;
  duration: number;
  self_id: number;
  time: number;
}

/** 群消息撤回 */
export interface GroupRecallEvent {
  post_type: "notice";
  notice_type: "group_recall";
  group_id: number;
  user_id: number;
  operator_id: number;
  message_id: number;
  self_id: number;
  time: number;
}

/** 好友消息撤回 */
export interface FriendRecallEvent {
  post_type: "notice";
  notice_type: "friend_recall";
  user_id: number;
  message_id: number;
  self_id: number;
  time: number;
}

/** 群名片变更 */
export interface GroupCardEvent {
  post_type: "notice";
  notice_type: "group_card";
  group_id: number;
  user_id: number;
  card_new: string;
  card_old: string;
  self_id: number;
  time: number;
}

/** 通知事件联合类型 */
export type NoticeEvent =
  | GroupIncreaseEvent
  | GroupDecreaseEvent
  | GroupBanEvent
  | GroupRecallEvent
  | FriendRecallEvent
  | GroupCardEvent;

// ==================== 请求事件 ====================

/** 好友请求 */
export interface FriendRequestEvent {
  post_type: "request";
  request_type: "friend";
  user_id: number;
  comment: string;
  flag: string;
  self_id: number;
  time: number;
}

/** 入群请求 */
export interface GroupRequestEvent {
  post_type: "request";
  request_type: "group";
  sub_type: "add" | "invite";
  group_id: number;
  user_id: number;
  comment: string;
  flag: string;
  self_id: number;
  time: number;
}

/** 请求事件联合类型 */
export type RequestEvent = FriendRequestEvent | GroupRequestEvent;

// ==================== 元事件 ====================

/** 生命周期事件 */
export interface LifecycleMetaEvent {
  post_type: "meta_event";
  meta_event_type: "lifecycle";
  sub_type: "enable" | "disable" | "connect";
  self_id: number;
  time: number;
}

/** 心跳事件 */
export interface HeartbeatMetaEvent {
  post_type: "meta_event";
  meta_event_type: "heartbeat";
  status: {
    online: boolean;
    good: boolean;
  };
  interval: number;
  self_id: number;
  time: number;
}

/** 元事件联合类型 */
export type MetaEvent = LifecycleMetaEvent | HeartbeatMetaEvent;

// ==================== 统一事件类型 ====================

/** 所有事件的联合类型 */
export type BotEvent = MessageEvent | NoticeEvent | RequestEvent | MetaEvent;

/** 事件类型映射 */
export interface EventTypeMap {
  message: MessageEvent;
  notice: NoticeEvent;
  request: RequestEvent;
  meta_event: MetaEvent;
}

// ==================== API 响应类型 ====================

/** NapCat API 通用响应 */
export interface ApiResponse<T = unknown> {
  status: "ok" | "failed";
  retcode: number;
  data: T;
  message: string;
  echo?: string | null;
  wording?: string;
}

/** 发送消息响应 */
export interface SendMessageResponse {
  message_id: number;
}
