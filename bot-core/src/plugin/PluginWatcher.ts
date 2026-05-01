import { watch, type FSWatcher } from "fs";
import { readdir, stat } from "fs/promises";
import { join, resolve } from "path";

/** 插件目录变化事件 */
export type PluginChangeEvent =
  | { type: "add"; pluginName: string; dirPath: string }
  | { type: "change"; pluginName: string; dirPath: string }
  | { type: "remove"; pluginName: string };

export type PluginChangeHandler = (event: PluginChangeEvent) => void | Promise<void>;

/**
 * 插件目录监听器
 * 监听 plugins/ 目录变化，触发热加载
 */
export class PluginWatcher {
  private watcher: FSWatcher | null = null;
  private absDir: string;
  private knownPlugins = new Map<string, string>(); // pluginName -> dirPath
  private handler: PluginChangeHandler | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(dir: string) {
    this.absDir = resolve(dir);
  }

  /** 注册变化回调 */
  onChange(handler: PluginChangeHandler): void {
    this.handler = handler;
  }

  /**
   * 启动监听
   * 先扫描一次现有插件建立基线，然后开始监听变化
   */
  async start(): Promise<string[]> {
    // 扫描现有插件
    const existing = await this.scanPlugins();
    for (const [name, dirPath] of existing) {
      this.knownPlugins.set(name, dirPath);
    }

    // 开始监听目录
    try {
      this.watcher = watch(this.absDir, { recursive: false }, (eventType, filename) => {
        if (!filename) return;
        this.handleChange(filename);
      });
      console.log(`[PluginWatcher] 正在监听 ${this.absDir}`);
    } catch (err) {
      console.error(`[PluginWatcher] 监听失败:`, err);
    }

    return Array.from(this.knownPlugins.keys());
  }

  /** 停止监听 */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    console.log("[PluginWatcher] 已停止");
  }

  /** 获取已知插件列表 */
  getKnownPlugins(): Map<string, string> {
    return new Map(this.knownPlugins);
  }

  /**
   * 处理目录变化（防抖）
   * fs.watch 可能会短时间内触发多次事件
   */
  private handleChange(filename: string): void {
    // 防抖：500ms 内同一文件只处理一次
    const existing = this.debounceTimers.get(filename);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      filename,
      setTimeout(async () => {
        this.debounceTimers.delete(filename);
        await this.processChange(filename);
      }, 500),
    );
  }

  /**
   * 处理单次变化
   */
  private async processChange(filename: string): Promise<void> {
    const entryPath = join(this.absDir, filename);

    // 检查路径是否存在
    let exists = false;
    let isDir = false;
    try {
      const s = await stat(entryPath);
      exists = true;
      isDir = s.isDirectory();
    } catch {
      exists = false;
    }

    // 找到该路径对应的旧插件名
    let oldPluginName: string | null = null;
    for (const [name, dirPath] of this.knownPlugins) {
      if (dirPath === entryPath) {
        oldPluginName = name;
        break;
      }
    }

    if (exists && isDir) {
      // 目录存在：新增或修改
      const pluginFile = await this.findPluginFile(entryPath);
      if (!pluginFile) return;

      const pluginName = filename; // 用目录名作为插件名

      if (oldPluginName) {
        // 已知插件，文件变化 → 热重载
        console.log(`[PluginWatcher] 检测到变化: ${pluginName}`);
        this.knownPlugins.set(pluginName, entryPath);
        this.handler?.({ type: "change", pluginName, dirPath: entryPath });
      } else {
        // 新插件
        console.log(`[PluginWatcher] 检测到新插件: ${pluginName}`);
        this.knownPlugins.set(pluginName, entryPath);
        this.handler?.({ type: "add", pluginName, dirPath: entryPath });
      }
    } else if (!exists && oldPluginName) {
      // 目录被删除
      console.log(`[PluginWatcher] 检测到插件移除: ${oldPluginName}`);
      this.knownPlugins.delete(oldPluginName);
      this.handler?.({ type: "remove", pluginName: oldPluginName });
    }
  }

  /**
   * 扫描插件目录，返回插件名到路径的映射
   */
  private async scanPlugins(): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    let entries: string[];
    try {
      entries = await readdir(this.absDir);
    } catch {
      return result;
    }

    for (const entry of entries) {
      const entryPath = join(this.absDir, entry);
      try {
        const s = await stat(entryPath);
        if (!s.isDirectory()) continue;

        const pluginFile = await this.findPluginFile(entryPath);
        if (pluginFile) {
          result.set(entry, entryPath);
        }
      } catch {
        // 忽略无法访问的条目
      }
    }

    return result;
  }

  /**
   * 检查目录下是否有插件入口文件
   */
  private async findPluginFile(dirPath: string): Promise<string | null> {
    for (const name of ["index.ts", "index.js"]) {
      try {
        await stat(join(dirPath, name));
        return join(dirPath, name);
      } catch {
        // 文件不存在，继续
      }
    }
    return null;
  }
}
