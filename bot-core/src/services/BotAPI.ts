import type { ApiResponse, MessageSegment, SendMessageResponse } from "../event/EventTypes.js";

/** BotAPI 配置 */
export interface BotAPIConfig {
  /** HTTP API 地址，例如 http://192.168.2.14:13000 */
  baseUrl: string;
  /** 认证 Token */
  token: string;
}

/**
 * BotAPI 能力封装层
 * 封装 NapCat HTTP API 调用，插件通过此接口操作机器人
 */
export class BotAPI {
  private baseUrl: string;
  private token: string;

  constructor(config: BotAPIConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
  }

  /**
   * 调用 NapCat API（基础方法）
   * @param action - API 端点名称
   * @param params - 请求参数
   * @returns API 响应
   */
  async callApi<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/${action}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`[BotAPI] HTTP ${res.status}: ${res.statusText}`);
    }

    return res.json() as Promise<ApiResponse<T>>;
  }

  // ==================== 消息相关 ====================

  /**
   * 发送群消息
   * @param groupId - 群号
   * @param message - 消息内容（字符串自动转为文本消息段）
   */
  async sendGroupMsg(groupId: number, message: MessageSegment[] | string): Promise<ApiResponse<SendMessageResponse>> {
    const msg = typeof message === "string" ? [{ type: "text", data: { text: message } }] : message;
    return this.callApi<SendMessageResponse>("send_group_msg", {
      group_id: groupId,
      message: msg,
    });
  }

  /**
   * 发送私聊消息
   * @param userId - 用户 QQ 号
   * @param message - 消息内容
   */
  async sendPrivateMsg(userId: number, message: MessageSegment[] | string): Promise<ApiResponse<SendMessageResponse>> {
    const msg = typeof message === "string" ? [{ type: "text", data: { text: message } }] : message;
    return this.callApi<SendMessageResponse>("send_private_msg", {
      user_id: userId,
      message: msg,
    });
  }

  /**
   * 发送消息（通用）
   * @param messageType - 消息类型
   * @param groupId - 群号（群消息必填）
   * @param userId - 用户号（私聊必填）
   * @param message - 消息内容
   */
  async sendMsg(
    messageType: "group" | "private",
    groupId: number | undefined,
    userId: number | undefined,
    message: MessageSegment[] | string,
  ): Promise<ApiResponse<SendMessageResponse>> {
    const msg = typeof message === "string" ? [{ type: "text", data: { text: message } }] : message;
    const params: Record<string, unknown> = {
      message_type: messageType,
      message: msg,
    };
    if (groupId !== undefined) params.group_id = groupId;
    if (userId !== undefined) params.user_id = userId;
    return this.callApi<SendMessageResponse>("send_msg", params);
  }

  /**
   * 撤回消息
   * @param messageId - 消息 ID
   */
  async deleteMsg(messageId: number): Promise<ApiResponse> {
    return this.callApi("delete_msg", { message_id: messageId });
  }

  /**
   * 获取消息详情
   * @param messageId - 消息 ID
   */
  async getMsg(messageId: number): Promise<ApiResponse> {
    return this.callApi("get_msg", { message_id: messageId });
  }

  /**
   * 获取群历史消息
   * @param groupId - 群号
   * @param count - 数量
   */
  async getGroupMsgHistory(groupId: number, count = 20): Promise<ApiResponse> {
    return this.callApi("get_group_msg_history", {
      group_id: groupId,
      count,
    });
  }

  // ==================== 群相关 ====================

  /**
   * 获取群信息
   * @param groupId - 群号
   * @param noCache - 是否不使用缓存
   */
  async getGroupInfo(groupId: number, noCache = false): Promise<ApiResponse> {
    return this.callApi("get_group_info", { group_id: groupId, no_cache: noCache });
  }

  /**
   * 获取群列表
   * @param noCache - 是否不使用缓存
   */
  async getGroupList(noCache = false): Promise<ApiResponse> {
    return this.callApi("get_group_list", { no_cache: noCache });
  }

  /**
   * 获取群成员列表
   * @param groupId - 群号
   * @param noCache - 是否不使用缓存
   */
  async getGroupMemberList(groupId: number, noCache = false): Promise<ApiResponse> {
    return this.callApi("get_group_member_list", { group_id: groupId, no_cache: noCache });
  }

  /**
   * 获取群成员信息
   * @param groupId - 群号
   * @param userId - 用户 QQ 号
   * @param noCache - 是否不使用缓存
   */
  async getGroupMemberInfo(groupId: number, userId: number, noCache = false): Promise<ApiResponse> {
    return this.callApi("get_group_member_info", {
      group_id: groupId,
      user_id: userId,
      no_cache: noCache,
    });
  }

  /**
   * 禁言群成员
   * @param groupId - 群号
   * @param userId - 用户 QQ 号
   * @param duration - 禁言时长（秒），0 为解除禁言
   */
  async setGroupBan(groupId: number, userId: number, duration: number): Promise<ApiResponse> {
    return this.callApi("set_group_ban", {
      group_id: groupId,
      user_id: userId,
      duration,
    });
  }

  /**
   * 全员禁言
   * @param groupId - 群号
   * @param enable - 是否开启
   */
  async setGroupWholeBan(groupId: number, enable: boolean): Promise<ApiResponse> {
    return this.callApi("set_group_whole_ban", {
      group_id: groupId,
      enable,
    });
  }

  /**
   * 设置群名片
   * @param groupId - 群号
   * @param userId - 用户 QQ 号
   * @param card - 新名片
   */
  async setGroupCard(groupId: number, userId: number, card: string): Promise<ApiResponse> {
    return this.callApi("set_group_card", {
      group_id: groupId,
      user_id: userId,
      card,
    });
  }

  /**
   * 设置群名
   * @param groupId - 群号
   * @param groupName - 新群名
   */
  async setGroupName(groupId: number, groupName: string): Promise<ApiResponse> {
    return this.callApi("set_group_name", {
      group_id: groupId,
      group_name: groupName,
    });
  }

  /**
   * 退出群聊
   * @param groupId - 群号
   * @param isDismiss - 是否解散（群主）
   */
  async setGroupLeave(groupId: number, isDismiss = false): Promise<ApiResponse> {
    return this.callApi("set_group_leave", {
      group_id: groupId,
      is_dismiss: isDismiss,
    });
  }

  /**
   * 踢出群成员
   * @param groupId - 群号
   * @param userId - 用户 QQ 号
   * @param rejectRequest - 是否拒绝再次入群
   */
  async setGroupKick(groupId: number, userId: number, rejectRequest = false): Promise<ApiResponse> {
    return this.callApi("set_group_kick", {
      group_id: groupId,
      user_id: userId,
      reject_add_request: rejectRequest,
    });
  }

  // ==================== 好友相关 ====================

  /**
   * 获取好友列表
   * @param noCache - 是否不使用缓存
   */
  async getFriendList(noCache = false): Promise<ApiResponse> {
    return this.callApi("get_friend_list", { no_cache: noCache });
  }

  /**
   * 获取陌生人信息
   * @param userId - 用户 QQ 号
   * @param noCache - 是否不使用缓存
   */
  async getStrangerInfo(userId: number, noCache = false): Promise<ApiResponse> {
    return this.callApi("get_stranger_info", { user_id: userId, no_cache: noCache });
  }

  /**
   * 处理好友请求
   * @param flag - 请求 flag
   * @param approve - 是否同意
   * @param remark - 好友备注
   */
  async setFriendAddRequest(flag: string, approve: boolean, remark: string): Promise<ApiResponse> {
    return this.callApi("set_friend_add_request", {
      flag,
      approve,
      remark,
    });
  }

  /**
   * 处理入群请求
   * @param flag - 请求 flag
   * @param subType - 请求子类型
   * @param approve - 是否同意
   * @param reason - 拒绝理由
   */
  async setGroupAddRequest(flag: string, subType: "add" | "invite", approve: boolean, reason?: string): Promise<ApiResponse> {
    return this.callApi("set_group_add_request", {
      flag,
      sub_type: subType,
      approve,
      reason,
    });
  }

  // ==================== 其他 ====================

  /**
   * 发送戳一戳
   * @param userId - 目标用户 QQ 号
   * @param groupId - 群号（不填则为私聊戳）
   */
  async sendPoke(userId: number, groupId?: number): Promise<ApiResponse> {
    const params: Record<string, unknown> = { user_id: userId };
    if (groupId !== undefined) params.group_id = groupId;
    return this.callApi("send_poke", params);
  }

  /**
   * 获取登录号信息
   */
  async getLoginInfo(): Promise<ApiResponse<{ user_id: number; nickname: string }>> {
    return this.callApi("get_login_info");
  }

  /**
   * 获取状态
   */
  async getStatus(): Promise<ApiResponse<{ online: boolean; good: boolean }>> {
    return this.callApi("get_status");
  }

  /**
   * 设置在线状态
   * @param status - 状态码
   * @param extStatus - 扩展状态码
   * @param batteryStatus - 电量
   */
  async setOnlineStatus(status: number, extStatus: number, batteryStatus = 0): Promise<ApiResponse> {
    return this.callApi("set_online_status", {
      status,
      ext_status: extStatus,
      battery_status: batteryStatus,
    });
  }

  /**
   * 点赞
   * @param userId - 目标用户 QQ 号
   * @param times - 次数
   */
  async sendLike(userId: number, times = 1): Promise<ApiResponse> {
    return this.callApi("send_like", { user_id: userId, times });
  }

  /**
   * 获取系统收藏表情
   * @param count - 数量
   */
  async fetchCustomFace(count = 48): Promise<ApiResponse<string[]>> {
    return this.callApi<string[]>("fetch_custom_face", { count });
  }
}
