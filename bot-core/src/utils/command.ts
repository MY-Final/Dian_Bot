/**
 * 命令解析工具
 * 支持有空格和无空格两种写法
 *
 * 用法:
 *   parseCommand("启用welcome", ["启用", "停用"])  → { command: "启用", args: "welcome" }
 *   parseCommand("启用 welcome", ["启用", "停用"]) → { command: "启用", args: "welcome" }
 *   parseCommand("踢 123456", ["踢"])              → { command: "踢", args: "123456" }
 *   parseCommand("踢123456", ["踢"])               → { command: "踢", args: "123456" }
 *   parseCommand("帮助", ["帮助"])                  → { command: "帮助", args: "" }
 *   parseCommand("hello", ["启用"])                → null
 */

/** 解析结果 */
export interface ParsedCommand {
  /** 匹配到的命令 */
  command: string;
  /** 命令后的参数（已去除首尾空格） */
  args: string;
}

/**
 * 解析命令
 * @param input - 用户输入的原始文本
 * @param commands - 可用的命令前缀列表
 * @returns 解析结果，未匹配返回 null
 */
export function parseCommand(input: string, commands: string[]): ParsedCommand | null {
  const text = input.trim();
  if (!text) return null;

  // 按命令长度降序排序，优先匹配长命令（如 "停用" 优先于 "停"）
  const sorted = [...commands].sort((a, b) => b.length - a.length);

  for (const cmd of sorted) {
    // 有空格写法: "启用 welcome"
    if (text.startsWith(cmd + " ")) {
      return {
        command: cmd,
        args: text.slice(cmd.length + 1).trim(),
      };
    }

    // 无空格写法: "启用welcome"
    if (text.startsWith(cmd) && text.length > cmd.length) {
      return {
        command: cmd,
        args: text.slice(cmd.length).trim(),
      };
    }

    // 纯命令无参数: "帮助"
    if (text === cmd) {
      return {
        command: cmd,
        args: "",
      };
    }
  }

  return null;
}

/**
 * 检查输入是否匹配某个命令（不关心参数）
 * @param input - 用户输入
 * @param command - 命令
 * @param requireArgs - 是否要求有参数
 */
export function matchCommand(input: string, command: string, requireArgs = false): boolean {
  const text = input.trim();

  // 有空格
  if (text.startsWith(command + " ")) {
    return !requireArgs || text.slice(command.length + 1).trim().length > 0;
  }

  // 无空格
  if (text.startsWith(command) && text.length > command.length) {
    return true;
  }

  // 纯命令
  if (text === command) {
    return !requireArgs;
  }

  return false;
}
