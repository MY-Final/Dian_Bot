import { stat } from "fs/promises";
import { join, resolve } from "path";
import type { Plugin, PluginModule } from "./types.js";

/**
 * 插件加载器
 * 从文件系统扫描并动态加载插件
 */
export class PluginLoader {
  /** 已加载模块的缓存 key（用于清除缓存实现热重载） */
  private moduleCache = new Map<string, string>(); // pluginName -> fileUrl

  /**
   * 从指定目录加载所有插件
   * @param dir - 插件目录路径
   * @returns 加载的插件数组
   */
  async loadFromDir(dir: string): Promise<Plugin[]> {
    const plugins: Plugin[] = [];
    const absDir = resolve(dir);

    let entries: string[];
    try {
      const dirStat = await stat(absDir);
      if (!dirStat.isDirectory()) {
        console.warn(`[PluginLoader] "${absDir}" 不是目录`);
        return plugins;
      }
      entries = await import("fs/promises").then((fs) => fs.readdir(absDir));
    } catch {
      console.warn(`[PluginLoader] 插件目录 "${absDir}" 不存在`);
      return plugins;
    }

    for (const entry of entries) {
      const entryPath = join(absDir, entry);
      const entryStat = await stat(entryPath);

      if (!entryStat.isDirectory()) continue;

      const pluginFile = await this.findPluginFile(entryPath);
      if (!pluginFile) continue;

      try {
        const plugin = await this.loadPlugin(entry, pluginFile);
        if (plugin) {
          plugins.push(plugin);
          console.log(`[PluginLoader] 已加载插件: ${plugin.name} (${pluginFile})`);
        }
      } catch (err) {
        console.error(`[PluginLoader] 加载插件失败 "${pluginFile}":`, err);
      }
    }

    return plugins;
  }

  /**
   * 从目录加载单个插件
   * @param pluginName - 插件名（目录名）
   * @param dirPath - 插件目录绝对路径
   * @returns 加载的插件，失败返回 null
   */
  async loadSingle(pluginName: string, dirPath: string): Promise<Plugin | null> {
    const pluginFile = await this.findPluginFile(dirPath);
    if (!pluginFile) {
      console.warn(`[PluginLoader] "${dirPath}" 下没有入口文件`);
      return null;
    }

    try {
      const plugin = await this.loadPlugin(pluginName, pluginFile);
      if (plugin) {
        console.log(`[PluginLoader] 已加载插件: ${plugin.name} (${pluginFile})`);
      }
      return plugin;
    } catch (err) {
      console.error(`[PluginLoader] 加载插件失败 "${pluginFile}":`, err);
      return null;
    }
  }

  /**
   * 清除指定插件的模块缓存（下次 import 会重新加载）
   * @param pluginName - 插件名
   */
  invalidateCache(pluginName: string): void {
    this.moduleCache.delete(pluginName);
  }

  /**
   * 从文件加载单个插件（带缓存清除）
   */
  private async loadPlugin(pluginName: string, filePath: string): Promise<Plugin | null> {
    // 添加时间戳参数绕过 ESM 模块缓存
    const timestamp = Date.now();
    const fileUrl = `file:///${filePath.replace(/\\/g, "/")}?t=${timestamp}`;

    // 清除旧缓存（如果有）
    this.invalidateCache(pluginName);

    const mod: PluginModule = await import(fileUrl);

    if (!mod.default) {
      console.warn(`[PluginLoader] "${filePath}" 没有 default export`);
      return null;
    }

    const plugin = mod.default;

    // 校验插件格式
    if (!plugin.name) {
      console.warn(`[PluginLoader] "${filePath}" 缺少 name 属性`);
      return null;
    }

    // 记录缓存 key
    this.moduleCache.set(pluginName, fileUrl);

    return plugin;
  }

  /**
   * 检查目录下是否有插件入口文件
   */
  private async findPluginFile(dirPath: string): Promise<string | null> {
    for (const name of ["index.ts", "index.js"]) {
      const filePath = join(dirPath, name);
      try {
        await stat(filePath);
        return filePath;
      } catch {
        // 文件不存在，继续
      }
    }
    return null;
  }
}
