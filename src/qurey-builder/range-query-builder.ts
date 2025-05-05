import * as Tablestore from 'tablestore';

import { ModelStatic, PlainPrimaryKeys } from '../model';
import { BaseZod, DbSchema, KeyAllowed, OutputType } from '../schema';
import { errorResult, executeSdkCall, OdmResult, successResult } from '../utils';
import { FilterFactory } from './filter-factory';

const DEFAULT_LIMIT = 20;

export type QueryResponse<T extends BaseZod> = {
  rows: OutputType<T>[];
  nextStartPrimaryKey?: Tablestore.PrimaryKeyOutput;
};

export class RangeQueryBuilder<T extends BaseZod> {
  // --- Dependencies & Context ---
  private readonly client: Tablestore.Client;
  private readonly modelClass: ModelStatic<T>;
  private readonly indexName: string | undefined; //  GSI 名称
  private readonly shcema: DbSchema<T>;

  // --- Internal Query State ---
  private _startPrimaryKey: Tablestore.PrimaryKeyInput | undefined = undefined;
  private _endPrimaryKey: Tablestore.PrimaryKeyInput | undefined = undefined;
  private _direction: "FORWARD" | "BACKWARD" = Tablestore.Direction.FORWARD;
  private _limit: number;
  private _columnsToGet: KeyAllowed<T> | undefined = undefined;
  private _filter: Tablestore.ColumnCondition | undefined = undefined;

  constructor(
    modelClass: ModelStatic<T>,
    client: Tablestore.Client,
    indexName?: string
  ) {
    if (indexName) {
      const gsi = modelClass.schema.globalSecondaryIndexes.find(
        (gsi) => gsi.indexName === indexName
      );
      if (!gsi) {
        throw new Error(
          `GSI ${indexName} not found in model ${modelClass.name}`
        );
      }
    }
    this.modelClass = modelClass;
    this.client = client;
    this.indexName = indexName;
    this.shcema = modelClass.schema;
    this._limit = DEFAULT_LIMIT;
  }

  /**
   * 设置范围查询的起始主键。
   * @param pk - 包含部分或全部目标主键的 JS 对象。
   */
  public startWith(pk: PlainPrimaryKeys): this {
    const { missingKeys, output } = this.shcema.convertToTablestorePks(
      pk,
      this.indexName
    );
    for (const key of missingKeys) {
      output.push({ [key]: Tablestore.INF_MIN as Tablestore.VirtualData });
    }
    this._startPrimaryKey = output;
    return this;
  }
  /**
   * 设置范围查询的结束主键（不包含）。
   * @param pk - 包含部分或全部目标主键的 JS 对象。
   */
  public endAt(pk: PlainPrimaryKeys): this {
    const { missingKeys, output } = this.shcema.convertToTablestorePks(
      pk,
      this.indexName
    );
    for (const key of missingKeys) {
      output.push({ [key]: Tablestore.INF_MAX as Tablestore.VirtualData });
    }
    this._endPrimaryKey = output;
    return this;
  }
  /**
   * 设置查询方向。
   * @param dir - 'FORWARD' 或 'BACKWARD'。
   */
  public direction(dir: "FORWARD" | "BACKWARD"): this {
    this._direction = Tablestore.Direction[dir];
    return this;
  }
  /**
   * 设置返回的最大行数。
   * @param count - 限制数量。
   */
  public limit(count: number): this {
    if (count > 0) {
      this._limit = count;
    } else {
      this._limit = DEFAULT_LIMIT; //  默认20
    }
    return this;
  }
  /**
   * 指定要返回的列。
   * @param fields - 列名数组。对于 GSI，应为索引键或投影列。
   */
  public select(fields: KeyAllowed<T>): this {
    if (fields.length == 0) {
      this._columnsToGet = [...this.shcema.difinitionKeys];
    } else {
      this._columnsToGet = [
        ...this.shcema.difinitionKeys.filter((key) => fields.includes(key)),
      ];
    }
    return this;
  }
  /**
   * 设置列过滤器（服务端后过滤）。
   * @param callback - 一个接收 FilterFactory 并返回最终 ColumnCondition 的函数。
   */
  public filter(
    callback: (factory: FilterFactory<T>) => Tablestore.ColumnCondition
  ): this {
    // 确保 schema 已经初始化
    const factory = new FilterFactory<T>(this.shcema); // 创建工厂实例，传入 schema
    try {
      this._filter = callback(factory); // 调用回调并存储结果
      // 可选：在这里或执行时检查条件数量是否超过 10
      const conditionCount = this.countConditions(this._filter);
      if (conditionCount > 10) {
        console.warn(
          "过滤器条件数量超过 10 个，可能导致 Tablestore 请求失败。"
        );
      }
    } catch (error: any) {
      // 提供更清晰的错误上下文
      throw new Error(`构建过滤器时出错: ${error.message}`);
    }
    return this;
  }

  // 可选的辅助函数来计算条件数量 (递归)
  private countConditions(
    condition: Tablestore.ColumnCondition | undefined
  ): number {
    if (!condition) return 0;
    if (condition instanceof Tablestore.SingleColumnCondition) {
      return 1;
    }
    if (condition instanceof Tablestore.CompositeCondition) {
      let count = 0;
      const subConditions =
        // @ts-ignore _subConditions可能是私有的，取决于 SDK 版本，需要检查
        condition["_subConditions"] || condition["sub_conditions"] || [];
      for (const sub of subConditions) {
        count += this.countConditions(sub);
      }
      return count;
    }
    return 0;
  }

  /**
   * 执行 getRange 查询。
   * @returns Promise<OdmResult<Document<T>[]>>
   */
  public async exec(): Promise<OdmResult<QueryResponse<T>>> {
    if (!this._startPrimaryKey) {
      this.startWith({});
    }
    if (!this._endPrimaryKey) {
      this.endAt({});
    }
    if (!this._columnsToGet) {
      this._columnsToGet = [...this.shcema.difinitionKeys];
    }

    const [err, _sdkResult] = await executeSdkCall(() =>
      this.client.getRange({
        tableName: this.indexName ?? this.modelClass.tableName,
        inclusiveStartPrimaryKey: this._startPrimaryKey!,
        exclusiveEndPrimaryKey: this._endPrimaryKey!,
        limit: this._limit,
        direction: this._direction,
        columnFilter: this._filter,
        columnsToGet: this._columnsToGet as string[] | undefined,
      })
    );
    if (err) {
      return errorResult(err);
    }
    const jsData = _sdkResult?.rows.map((r) => this.shcema.convertToJs(r));
    return successResult({
      rows: jsData?.filter((j) => !!j) ?? [],
      nextStartPrimaryKey: _sdkResult?.nextStartPrimaryKey,
    });
  }

  /**
   * 执行查询并返回第一个匹配的文档或 null。
   * @returns Promise<OdmResult<OutputType<T> | null>>
   */
  public async findOne(): Promise<OdmResult<OutputType<T> | null>> {
    this.limit(1);
    const [err, response] = await this.exec();
    if (err) {
      return errorResult(err);
    }
    const data = response?.rows ?? [];
    return successResult(data.length > 0 ? data[0] : null);
  }
}
