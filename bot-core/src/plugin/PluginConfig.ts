import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve, dirname } from "path";

/**
 * 插件配置管理器
 * 每个插件一个 JSON 配置文件：plugins/<name>/config.json
 */
export class PluginConfigManager {
  private baseDir: string;
  private cache = new Map<string, Record<string, unknown>>();

  constructor(pluginsDir: string) {
    this.baseDir = resolve(pluginsDir);
  }

  /**
   * 获取配置文件路径
   */
  private getConfigPath(pluginName: string): string {
    return join(this.baseDir, pluginName, "config.json");
  }

  /**
   * 加载插件配置
   * @param pluginName - 插件名称
   * @returns 配置对象，文件不存在时返回空对象
   */
  async load(pluginName: string): Promise<Record<string, unknown>> {
    // 优先返回缓存
    if (this.cache.has(pluginName)) {
      return this.cache.get(pluginName)!;
    }

    const configPath = this.getConfigPath(pluginName);
    let config: Record<string, unknown> = {};

    try {
      const content = await readFile(configPath, "utf-8");
      config = JSON.parse(content);
    } catch {
      // 文件不存在或解析失败，使用空配置
    }

    this.cache.set(pluginName, config);
    return config;
  }

  /**
   * 保存插件配置
   * @param pluginName - 插件名称
   * @param config - 配置对象
   */
  async save(pluginName: string, config: Record<string, unknown>): Promise<void> {
    const configPath = this.getConfigPath(pluginName);

    // 确保目录存在
    await mkdir(dirname(configPath), { recursive: true });

    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    this.cache.set(pluginName, config);
  }

  /**
   * 获取单个配置项
   * @param pluginName - 插件名称
   * @param key - 配置键
   * @param defaultVal - 默认值
   */
  async get<T>(pluginName: string, key: string, defaultVal: T): Promise<T> {
    const config = await this.load(pluginName);
    return (key in config ? config[key] : defaultVal) as T;
  }

  /**
   * 设置单个配置项
   * @param pluginName - 插件名称
   * @param key - 配置键
   * @param value - 配置值
   */
  async set(pluginName: string, key: string, value: unknown): Promise<void> {
    const config = await this.load(pluginName);
    config[key] = value;
    await this.save(pluginName, config);
  }

  /**
   * 检查配置项是否存在
   * @param pluginName - 插件名称
   * @param key - 配置键
   */
  async has(pluginName: string, key: string): Promise<boolean> {
    const config = await this.load(pluginName);
    return key in config;
  }

  /**
   * 删除配置项
   * @param pluginName - 插件名称
   * @param key - 配置键
   */
  async delete(pluginName: string, key: string): Promise<void> {
    const config = await this.load(pluginName);
    delete config[key];
    await this.save(pluginName, config);
  }

  /**
   * 清除缓存
   */
  clearCache(pluginName?: string): void {
    if (pluginName) {
      this.cache.delete(pluginName);
    } else {
      this.cache.clear();
    }
  }
}
