// src/model.ts
import * as Tablestore from "tablestore";

import { Connection } from "./connection";
import { RangeQueryBuilder } from "./qurey-builder/range-query-builder";
import { SearchQueryBuilder } from "./qurey-builder/search-query-builder";
import { BaseZod, DbSchema, InputType, OutputType } from "./schema";
// 假设通用工具在 './common' 中
import { errorResult, executeSdkCall, OdmResult, successResult } from "./utils";

/**
 *  用于表示主键值的纯 JavaScript 值类型。
 *  可以是字符串、数字、BigInt 或 Buffer。
 */
export type PlainPrimaryKeyValue = string | number | bigint | Buffer;

/**
 *  用于表示主键值的纯 JavaScript 对象类型。
 *  键是主键字段名，值是对应的 PlainPrimaryKeyValue。
 */
export type PlainPrimaryKeys = Record<string, PlainPrimaryKeyValue>;

/**
 *  `save` 方法的可选配置项。
 */
export interface SaveOptions {
  /** Tablestore 的写入条件 (Condition)，用于控制写入行为 (例如，仅在行不存在时写入)。 */
  condition?: Tablestore.Condition;
}

// --- 核心类型 ---

/**
 * Document 的基类，用于保存和管理数据。
 * 包含 Document 的基本属性和方法，包括 toObject、save、update、delete。
 * 子类需要实现 save、update、delete 方法。
 * @template InputType<T> 从 Schema 推断出的输入类型。
 * @template OutputType<T> 从 Schema 推断出的输出类型。
 */
export type Document<T extends BaseZod> = {
  /** 用于返回 Document 的值 */
  toObject(): OutputType<T> | InputType<T>;
  set(input: Partial<InputType<T>>): Document<T>;
  get(): Document<T>;
  /**
   * 将 Document 的当前状态（插入或更新）保存到 Tablestore。
   * 如果在 Schema 选项中启用了时间戳，则自动处理时间戳更新。
   * @param options 可选的保存配置，例如写入条件。
   * @returns 成功时返回包含已保存 Document 实例的 OdmResult，失败时返回 Error。
   */
  save(options?: SaveOptions): Promise<OdmResult<OutputType<T> | InputType<T>>>;

  /**
   * 部分更新 Document 的当前状态，并将其保存到 Tablestore。
   * @returns 成功时返回包含已更新 Document 实例的 OdmResult，失败时返回 Error。
   */
  fetch(): Promise<OdmResult<OutputType<T> | InputType<T> | undefined>>;

  /**
   * 使用提供的数据部分更新当前 Document 实例，并将其保存到 Tablestore。
   * @param updates 包含要更新的字段和值的对象 (Partial<InputType<T>>)。
   * @returns 成功时返回包含已更新 Document 实例的 OdmResult，失败时返回 Error。
   */
  update(updates: Partial<InputType<T>>): Promise<OdmResult<PlainPrimaryKeys>>;

  /**
   * 从 Tablestore 中删除与此 Document 实例对应的行。
   * @returns 成功时返回包含已删除 Document 主键的 OdmResult，失败时返回 Error。
   */
  delete(): Promise<OdmResult<PlainPrimaryKeys>>;
};

/**
 * 定义 Model 类的静态接口。
 * 提供用于创建、查询和管理 Document 的静态方法。
 * @template TSchema 定义模型结构的 Zod ObjectSchema。
 * @template InputType<T> 从 Schema 推断出的输入类型。
 * @template OutputType<T> 从 Schema 推断出的输出类型。
 */
export interface ModelStatic<T extends BaseZod> {
  // --- 静态属性 ---
  /** 模型的名称标识符。 */
  readonly modelName: string;
  /** 对应的 Tablestore 表名。 */
  readonly tableName: string;
  /** 关联的 DbSchema 实例。 */
  readonly schema: DbSchema<T>;
  /** 关联的 Connection 实例。 */
  readonly connection: Connection;
  /** Tablestore 客户端实例 (通过 getter 访问)。 */
  readonly client: Tablestore.Client;

  // --- 构造函数签名 ---
  /**
   * 创建 Document 的新实例。
   * 输入数据在构造期间根据 Schema 进行验证。
   * @param data 符合 InputType<T> 的输入数据对象。
   */
  new (data: InputType<T>): Document<T>;

  // --- 静态 CRUD 方法 ---
  /**
   * 根据提供的数据创建新的 Document 实例，对其进行验证，
   * 并使用 'EXPECT_NOT_EXIST' 条件将其保存到 Tablestore。
   * @param data 符合 InputType<T> 的输入数据对象。
   * @returns 成功时返回包含新创建 Document 实例的 OdmResult，失败时返回 Error。
   */
  create(data: InputType<T>): Promise<OdmResult<OutputType<T> | InputType<T>>>;

  /**
   * 通过主键值查找单个 Document。
   * @param primaryKeys 包含主键名称及其纯 JavaScript 值的记录。
   * @returns 成功时返回包含找到的 Document 实例（如果未找到则为 null）的 OdmResult，失败时返回 Error。
   */
  findById(
    primaryKeys: PlainPrimaryKeys
  ): Promise<OdmResult<OutputType<T> | InputType<T> | undefined>>;

  /**
   * 通过主键静态地更新一个 Document 的部分属性。
   * @param primaryKeys 包含主键字段和对应 JavaScript 值的对象。
   * @param updates 一个包含要更新的字段和对应 JavaScript 值的对象 (Partial<InputType<T>>)。
   * @returns 成功时返回包含更新后 Document 实例的 OdmResult，失败时返回 Error。
   */
  updateById(
    primaryKeys: PlainPrimaryKeys,
    updates: Partial<InputType<T>>
  ): Promise<OdmResult<PlainPrimaryKeys>>;

  /**
   * 通过主键静态地删除一个 Document。
   * @param primaryKeys 包含主键字段和对应 JavaScript 值的对象。
   * @returns 成功时返回包含删除结果 (deleted 状态和主键) 的 OdmResult，失败时返回 Error。
   */
  deleteById(
    primaryKeys: PlainPrimaryKeys
  ): Promise<OdmResult<PlainPrimaryKeys>>;
}

// --- 模型创建函数 ---

/**
 * 用于创建绑定到特定 Schema、表和连接的 Model 类的工厂函数。
 * @param name 模型的名称标识符。
 * @param schema 定义数据结构和规则的 Schema 实例。
 * @param tableName 对应的 Tablestore 表名。
 * @param connection 管理 Tablestore 客户端的 Connection 实例。
 * @returns 一个可供使用的 ModelStatic 类。
 */

const ignoreCondition = new Tablestore.Condition(
  Tablestore.RowExistenceExpectation.IGNORE,
  null
);
const expectExistCondition = new Tablestore.Condition(
  Tablestore.RowExistenceExpectation.EXPECT_EXIST,
  null
);
const expectNotExistCondition = new Tablestore.Condition(
  Tablestore.RowExistenceExpectation.EXPECT_NOT_EXIST,
  null
);

export function createModel<T extends BaseZod>(
  name: string,
  schema: DbSchema<T>,
  tableName: string,
  connection: Connection
) {
  // 从提供的 Schema 推断输入和输出类型

  // 处理实例数据和核心方法的基类
  class BaseDocument {
    _data: InputType<T> | OutputType<T>; // 保存经过验证的 Document 数据

    /**
     * 用于创建 Document 实例的受保护构造函数。
     * 处理初始数据验证，除非被绕过。
     * @param data 输入数据 (InputType<T>) 或已验证的数据 (OutputType<T>)。
     * @param _bypassParse 用于跳过解析的内部标志 (在从数据库加载时使用)。
     */
    protected constructor(data: InputType<T>, _bypassParse: boolean = false) {
      if (_bypassParse && typeof data === "object" && data !== null) {
        // 直接分配假定有效的数据 (例如，来自 findById)
        this._data = data as OutputType<T>;
        return;
      }
      // 验证和转换数据
      const { error, output } = schema.parse(data);
      if (error) {
        throw error;
      }
      this._data = output;
    }

    /** 返回内部 Document 数据的浅拷贝。 */
    toObject(): OutputType<T> | InputType<T> {
      return { ...this._data };
    }

    get(): this {
      return this;
    }

    set(input: Partial<InputType<T>>): this {
      this._data = { ...this._data, ...input };
      return this;
    }
    getPlainPrimaryKey(): PlainPrimaryKeys {
      return schema.parsePks(this._data).output;
    }
    getPlainAttributes(): Record<string, unknown> {
      return schema.parseAttrs(this._data).output;
    }
    /** 将 Document 保存到 Tablestore。 */
    async save(options?: SaveOptions) {
      // 通过具体类 (ModelClass) 访问静态属性
      const modelSchema = ModelClass.schema;
      const client = ModelClass.client;
      const currentTableName = ModelClass.tableName;
      // --- 准备 Tablestore 数据 ： 验证和转换数据---
      const { error: pksErr, output: primaryKeysArr } =
        modelSchema.convertToTablestorePks(this._data);
      const { error: attrsErr, output: attributesArr } =
        modelSchema.convertToTablestoreAttributes(this._data);
      if (pksErr || attrsErr) {
        return errorResult(
          new Error(`数据校验失败：${pksErr?.message}; ${attrsErr?.message}`)
        );
      }
      // --- 执行 Tablestore 操作 ---
      // 使用辅助函数执行 SDK 调用
      const [err, _sdkResult] = await executeSdkCall(() =>
        client.putRow({
          tableName: currentTableName,
          condition: options?.condition || ignoreCondition,
          primaryKey: primaryKeysArr,
          attributeColumns: attributesArr,
          returnContent: { returnType: Tablestore.ReturnType.Primarykey }, // 不需要从 putRow 返回数据
        })
      );
      if (err) {
        return errorResult(
          new Error(
            `将 "${name}" 的 Document 保存到 Tablestore 失败: 配置错误或者 PrimaryKey 冲突。`
          )
        ); // 返回数据库错误
      }
      return successResult(this.toObject()); // 返回当前（可能已更新时间戳）实例
    }

    async fetch() {
      const modelSchema = ModelClass.schema;
      const client = ModelClass.client;
      const currentTableName = ModelClass.tableName;
      const self = this; // Reference to the full Document instance
      // --- 1. 验证数据 ---
      // 1.1 验证主键
      const { error, output } = modelSchema.convertToTablestorePks(this._data);
      if (error) {
        return errorResult(error);
      }
      // --- 2. 执行查询 ---
      const [dbErr, response] = await executeSdkCall(() =>
        client.getRow({
          tableName: currentTableName,
          primaryKey: output,
        })
      );
      if (dbErr) {
        dbErr.message = `从 Tablestore 获取 "${name}" 的 Document 失败: ${dbErr.message}`;
        return errorResult(dbErr); // 返回数据库错误
      }
      // 3. 处理响应
      if (!response?.row || !response.row || !response.row.primaryKey) {
        // 未找到
        return successResult(undefined);
      }
      const row = schema.convertToJs(response.row);
      if (row) {
        self.set(row);
        return successResult(row);
      }
      return successResult(undefined);
    }

    /** 部分更新 Document。 */
    async update(
      updates: Partial<InputType<T>>
    ): Promise<OdmResult<PlainPrimaryKeys>> {
      const modelSchema = ModelClass.schema;
      const client = ModelClass.client;
      const currentTableName = ModelClass.tableName;

      // --- 1. 验证数据 ---
      // 1.1 验证主键
      const { error: pksErr, output: primaryKeysArr } =
        modelSchema.convertToTablestorePks(this._data);
      if (pksErr) {
        return errorResult(pksErr);
      }
      // 1.2 验证更新
      const { error: attrsErr, output: attributesArr } =
        modelSchema.convertToTablestoreUpdates(updates);
      if (attrsErr) {
        return errorResult(attrsErr);
      }
      // --- 2. 执行更新 ---
      const [dbErr, _sdkResult] = await executeSdkCall(() =>
        client.updateRow({
          tableName: currentTableName,
          condition: expectExistCondition, // 存在才更新
          primaryKey: primaryKeysArr,
          updateOfAttributeColumns: attributesArr,
          returnContent: { returnType: Tablestore.ReturnType.Primarykey },
        })
      );
      if (dbErr) {
        dbErr.message = `更新失败 "${name}" in Tablestore: ${dbErr.message}`;
        return errorResult(dbErr); // Return database error
      }
      return successResult(this.getPlainPrimaryKey()); // Return the updated instance
    }

    /** 从 Tablestore 删除 Document。 */
    async delete(): Promise<OdmResult<PlainPrimaryKeys>> {
      const client = ModelClass.client;
      const modelSchema = ModelClass.schema;
      const currentTableName = ModelClass.tableName;
      // --- 1. 验证数据 ---
      const { error, output } = modelSchema.convertToTablestorePks(this._data);
      if (error) {
        return errorResult(error);
      }
      // --- 2. 执行删除 ---
      const [err, _sdkResult] = await executeSdkCall(() =>
        client.deleteRow({
          tableName: currentTableName,
          condition: expectExistCondition,
          primaryKey: output,
        })
      );
      if (err) {
        err.message = `从 Tablestore 删除 "${name}" 的 Document 失败: ${err.message}`;
        return errorResult(err); // 返回数据库错误
      }
      // 操作成功
      return successResult(this.getPlainPrimaryKey()); // 返回已删除 Document 的主键
    }
  }

  // 最终的 Model 类，继承实例逻辑并添加静态方法
  // @ts-ignore - TypeScript struggles validating static side against interface fully
  class ModelClass extends BaseDocument implements Document<T> {
    // --- 静态属性 ---
    static readonly modelName = name;
    static readonly tableName = tableName;
    static readonly schema = schema;
    static readonly connection = connection;
    // 用于从连接访问惰性加载的客户端的 Getter
    static get client(): Tablestore.Client {
      return connection.getClient();
    }

    // --- 构造函数 ---
    // 继承 BaseDocument 构造函数以创建实例
    constructor(data: InputType<T>, _bypassParse: boolean = false) {
      super(data, _bypassParse);
    }

    // --- 静态方法 ---
    /** 创建并保存一个新的 Document。 */
    static async create(data: InputType<T>) {
      // 1. 创建实例（验证在构造函数中进行）
      const docInstance = new ModelClass(data);
      // 2. 使用 EXPECT_NOT_EXIST 条件调用实例的 save 方法
      return await docInstance.save({
        condition: expectNotExistCondition,
      });
    }

    /** 通过主键查找 Document。 */
    static async findById(primaryKeys: PlainPrimaryKeys) {
      const docInstance = new ModelClass(primaryKeys, true);
      return await docInstance.fetch();
    }
    /**
     * 通过主键静态地删除一个 Document。
     * @param primaryKeys 包含主键字段和对应 JavaScript 值的对象。
     * @returns 包含删除结果 (是否成功和主键) 或错误信息的 OdmResult。
     */
    static async deleteById(primaryKeys: PlainPrimaryKeys) {
      const docInstance = new ModelClass(primaryKeys as InputType<T>, true);
      return await docInstance.delete();
    } // deleteById 结束
    /**
     * 通过主键静态地更新一个 Document 的部分属性。
     * @param primaryKeys 包含主键字段和对应 JavaScript 值的对象。
     * @param updates 一个包含要更新的字段和对应 JavaScript 值的对象 (Partial<InputType<T>>)。
     * @returns 包含更新结果 (是否成功和主键) 或错误信息的 OdmResult。
     */
    static async updateById(
      primaryKeys: PlainPrimaryKeys,
      updates: Partial<InputType<T>>
    ) {
      const docInstance = new ModelClass(
        {
          ...primaryKeys,
          ...updates,
        },
        true
      ); // 构造一个临时实例以获取 Schema
      return await docInstance.update(updates);
    } // updateById 结束

    static async _batchWrite(
      input: Partial<InputType<T>>[],
      type: "INSERT" | "DELETE"
    ) {
      const client = this.client;
      const arr = input.map((i) => {
        const pks = schema.convertToTablestorePks(i);
        const attrs = schema.convertToTablestoreAttributes(i);
        return {
          pks: pks.output,
          attributes: attrs.output,
          error: type == "DELETE" ? pks.error : pks.error || attrs.error,
        };
      });
      const errs = arr.filter((a) => a.error);
      if (errs.length > 0) {
        const err = new Error();
        err.message = errs.join(";");
        return errorResult(err);
      }
      let params: Tablestore.BatchWriteRowParams = {
        tables: [
          {
            tableName: this.tableName,
            rows: [],
          },
        ],
      };
      switch (type) {
        case "DELETE":
          params.tables[0].rows = params.tables[0].rows.concat(
            arr.map((a) => ({
              type: "DELETE",
              primaryKey: a.pks,
              condition: expectExistCondition,
              returnContent: { returnType: Tablestore.ReturnType.Primarykey },
            }))
          );
          break;
        case "INSERT":
          params.tables[0].rows = params.tables[0].rows.concat(
            arr.map((a) => ({
              type: "PUT",
              primaryKey: a.pks,
              attributeColumns: a.attributes,
              condition: expectNotExistCondition,
              returnContent: { returnType: Tablestore.ReturnType.Primarykey },
            }))
          );
          break;
      }
      const [err, _sdkResult] = await executeSdkCall(() =>
        client.batchWriteRow(params)
      );
      if (err) {
        return errorResult(err);
      }
      const result = _sdkResult?.tables
        .filter((t) => t.isOk)
        .map((t) => t.primaryKey)
        .filter((t) => !!t)
        .map((item) => schema.convertPksTojs(item))
        .filter((t) => !!t);
      return successResult(result);
    }

    static async insertMany(input: InputType<T>[]) {
      return await this._batchWrite(input, "INSERT");
    }

    static async deleteMany(input: Partial<InputType<T>>[]) {
      return await this._batchWrite(input, "DELETE");
    }

    static range(): RangeQueryBuilder<T> {
      const client = this.connection.getClient();
      return new RangeQueryBuilder<T>(this, client);
    }
    static findByIndex(indexName: string): RangeQueryBuilder<T> {
      const client = this.connection.getClient();
      return new RangeQueryBuilder<T>(this, client, indexName);
    }

    static search(indexName: string): SearchQueryBuilder<T> {
      const client = this.connection.getClient();
      return new SearchQueryBuilder<T>(this, client, indexName);
    }
  }

  return ModelClass;
}

export { OutputType };
