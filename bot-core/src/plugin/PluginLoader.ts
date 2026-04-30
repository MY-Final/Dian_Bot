import { readdir, stat } from "fs/promises";
import { join, resolve } from "path";
import type { Plugin, PluginModule } from "./types.js";

/**
 * 插件加载器
 * 从文件系统扫描并动态加载插件
 */
export class PluginLoader {
  /**
   * 从指定目录加载所有插件
   * @param dir - 插件目录路径（相对于当前工作目录）
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
      entries = await readdir(absDir);
    } catch {
      console.warn(`[PluginLoader] 插件目录 "${absDir}" 不存在`);
      return plugins;
    }

    for (const entry of entries) {
      const entryPath = join(absDir, entry);
      const entryStat = await stat(entryPath);

      if (!entryStat.isDirectory()) continue;

      // 检查是否有 index.ts 或 index.js
      const tsFile = join(entryPath, "index.ts");
      const jsFile = join(entryPath, "index.js");

      let pluginFile: string | null = null;
      try {
        await stat(tsFile);
        pluginFile = tsFile;
      } catch {
        try {
          await stat(jsFile);
          pluginFile = jsFile;
        } catch {
          // 目录下没有入口文件，跳过
          continue;
        }
      }

      try {
        const plugin = await this.loadPlugin(pluginFile);
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
   * 从文件加载单个插件
   * @param filePath - 插件入口文件路径
   */
  private async loadPlugin(filePath: string): Promise<Plugin | null> {
    // 动态 import 插件模块
    // tsx runtime 会自动处理 .ts 文件
    const fileUrl = `file:///${filePath.replace(/\\/g, "/")}`;
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

    return plugin;
  }
}
