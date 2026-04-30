import { readFile, writeFile, mkdir } from "fs/promises";
import { join, resolve, dirname } from "path";

/**
 * 插件存储接口
 * 提供 key-value 持久化能力
 */
export interface PluginStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

/**
 * 基于 JSON 文件的存储实现
 * 数据存储在：plugins/<name>/data.json
 */
export class JsonFileStore implements PluginStore {
  private filePath: string;
  private data: Record<string, unknown> | null = null;

  constructor(pluginsDir: string, pluginName: string) {
    this.filePath = join(resolve(pluginsDir), pluginName, "data.json");
  }

  /**
   * 加载数据（懒加载 + 缓存）
   */
  private async ensureLoaded(): Promise<Record<string, unknown>> {
    if (this.data !== null) return this.data;

    try {
      const content = await readFile(this.filePath, "utf-8");
      this.data = JSON.parse(content);
    } catch {
      this.data = {};
    }
    return this.data!;
  }

  /**
   * 保存数据到文件
   */
  private async saveData(): Promise<void> {
    if (!this.data) return;

    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const data = await this.ensureLoaded();
    return data[key] as T | undefined;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const data = await this.ensureLoaded();
    data[key] = value;
    await this.saveData();
  }

  async delete(key: string): Promise<void> {
    const data = await this.ensureLoaded();
    delete data[key];
    await this.saveData();
  }

  async has(key: string): Promise<boolean> {
    const data = await this.ensureLoaded();
    return key in data;
  }

  async keys(): Promise<string[]> {
    const data = await this.ensureLoaded();
    return Object.keys(data);
  }

  async clear(): Promise<void> {
    this.data = {};
    await this.saveData();
  }
}
