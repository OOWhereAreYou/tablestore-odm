// src/connection.ts

import { config } from "dotenv";
import * as Tablestore from "tablestore";

config();
/**
 * Tablestore ODM 连接配置项。
 * 包含核心配置并允许透传其他 Tablestore.Client 选项。
 */
export interface OdmConfig {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  instancename: string;
  stsToken?: string; // 可选的 STS 令牌
  /** Optional: Maximum number of retries for Tablestore operations. */
  maxRetries?: number; // 可选: 操作的最大重试次数
  /** Optional: Request timeout in milliseconds. */
  requestTimeout?: number; // 可选: 请求超时时间 (毫秒)
  /** Optional: Custom logger instance. */
  logger?: Console; // 可选: 自定义 logger 实例
  /**
   * Allow any other Tablestore client options to be passed through.
   * Using unknown for better type safety than any.
   */
  [key: string]: unknown;
}

/**
 * 管理 Tablestore 连接 。
 */
export class Connection {
  private readonly config: OdmConfig;
  private client: Tablestore.Client | null = null;
  constructor(config: OdmConfig) {
    const endpoint = config.endpoint ?? process.env.TABLE_STORE_ENDPOINT ?? "";
    const accessKeyId =
      config.accessKeyId ?? process.env.TABLE_STORE_ACCESS_KEY_ID ?? "";
    const secretAccessKey =
      config.secretAccessKey ?? process.env.TABLE_STORE_SECRET_ACCESS_KEY ?? "";
    const instancename =
      config.instancename ?? process.env.TABLE_STORE_INSTANCE_NAME ?? "";

    // 验证必要的配置是否存在
    if (!endpoint || !accessKeyId || !secretAccessKey || !instancename) {
      throw new Error(
        "缺少必要的 Tablestore 配置信息 (endpoint, accessKeyId, secretAccessKey, instancename)"
      );
    }

    this.config = {
      endpoint,
      accessKeyId,
      secretAccessKey,
      instancename,
    };
  }

  /**
   * 获取 Tablestore.Client 实例 (懒加载)。
   * @returns {Tablestore.Client} Tablestore 客户端实例
   */
  public getClient(): Tablestore.Client {
    if (!this.client) {
      // 使用存储的配置创建 Client
      // OdmConfig 结构应该与 Client 构造函数兼容
      this.client = new Tablestore.Client(this.config);
    }
    return this.client;
  }
}
