import * as Tablestore from 'tablestore';

import { ModelStatic, OutputType } from '../model'; // 假设 OutputType 在 model.ts
import { BaseZod, KeyAllowed } from '../schema'; // 假设 DbSchema 包含 Search Index 定义
import { errorResult, executeSdkCall, OdmResult, successResult } from '../utils'; // 假设在 utils
import { QueryFactory, SearchQuery } from './query-factory';

const DEFAULT_SEARCH_LIMIT = 10;

const ColumnReturnType = Tablestore.ColumnReturnType;

export class SearchQueryBuilder<T extends BaseZod> {
  // --- 依赖 ---
  private readonly client: Tablestore.Client;
  private readonly modelClass: ModelStatic<T>;
  private readonly indexName: string;

  // --- 内部查询状态 ---
  private _query: SearchQuery["query"] | undefined = undefined; // 核心的查询逻辑
  private _limit: SearchQuery["limit"] | undefined = undefined; // 最大行数
  private _offset: SearchQuery["offset"] | undefined = undefined; // 起始偏移量
  private _token: SearchQuery["token"] | undefined = undefined; // 深度分页的 token
  private _getTotalCount: SearchQuery["getTotalCount"] = true; // 是否返回匹配的总行数
  private _select: KeyAllowed<T> | undefined = undefined; // 要返回的列
  constructor(
    modelClass: ModelStatic<T>,
    client: Tablestore.Client,
    indexName: string
  ) {
    const searchIndex = modelClass.schema.searchIndexs.find(
      (item) => item.indexName === indexName
    );
    if (!searchIndex) {
      throw new Error(`未找到索引 "${indexName}" 的定义`);
    }
    this.modelClass = modelClass;
    this.client = client;
    this.indexName = indexName;
  }

  /**
   * 设置核心的查询逻辑。
   * 建议使用 QueryFactory 来创建查询对象。
   * @param query - 一个 Tablestore.Query 对象 (例如 MatchQuery, BoolQuery 等)。
   */
  public filter(callback: (factory: QueryFactory) => SearchQuery): this {
    const factory = new QueryFactory();
    try {
      const { query } = callback(factory);
      this._query = query;
    } catch (e: any) {
      throw new Error(`查询构造失败：${e.message}`);
    }
    return this;
  }

  /**
   * 设置返回的最大行数。
   * @param count - 限制数量。
   */
  public limit(count: number): this {
    this._limit = count;
    return this;
  }

  /**
   * 设置查询结果的起始偏移量（用于基础分页）。
   * 注意：对于深度分页，使用 `nextToken` 更高效。
   * @param value - 偏移量 (从 0 开始)。
   */
  public offset(value: number): this {
    this._offset = value;
    return this;
  }

  /**
   * 设置用于深度分页的 token。
   * 通常从上一次查询结果的 `nextToken` 获取。
   * @param token - Uint8Array 类型的分页令牌。
   */
  public token(token: Buffer): this {
    this._token = token;
    return this;
  }

  /**
   * 指定要返回的列。
   * 如果不指定，Tablestore 默认只返回主键列。
   * 指定的列必须是 Search Index 中的索引字段或存储字段 (Store=true)。
   * @param fields - 列名数组。传空数组或 null/undefined 表示只返回主键。
   */
  public select(fields: KeyAllowed<T>): this {
    this._select = fields;
    return this;
  }

  /**
   * 设置是否返回匹配的总行数。
   * 注意：这可能会增加查询延迟和费用。
   * @param getTotal - true 表示需要返回总数。
   */
  public getTotalCount(getTotal: boolean = true): this {
    this._getTotalCount = getTotal;
    return this;
  }

  /**
   * 执行 search 查询。
   * @returns Promise<OdmResult<{ rows: OutputType<T>[], totalCount?: number, nextToken?: Uint8Array }>>
   */
  public async exec(): Promise<
    OdmResult<{ rows: OutputType<T>[]; totalCount?: number }>
  > {
    if (!this._query) {
      throw new Error("缺少查询条件");
    }
    const request: Tablestore.SearchParams = {
      tableName: this.modelClass.tableName,
      indexName: this.indexName,
      searchQuery: {
        query: this._query,
        token: this._token,
        limit: this._limit || DEFAULT_SEARCH_LIMIT,
        offset: this._offset || 0,
        getTotalCount: this._getTotalCount,
      },
      columnToGet: {
        returnNames: this._select as string[] | undefined,
        returnType:
          this._select && this._select.length > 0
            ? ColumnReturnType.RETURN_SPECIFIED
            : ColumnReturnType.RETURN_ALL,
      },
    };
    const [err, response] = await executeSdkCall(async () =>
      this.client.search(request)
    );
    if (err) {
      return errorResult(err);
    }
    const { rows, totalCounts, nextToken, isAllSucceeded } = response as any;
    if (!isAllSucceeded) {
      return successResult({
        rows: [],
        totalCount: 0,
        nextToken: undefined,
      });
    }
    return successResult({
      rows: rows.map((item: any) => this.modelClass.schema.convertToJs(item)),
      totalCount: Number(totalCounts) || 0,
    });
  }

  /**
   * 执行查询并返回第一个匹配的文档或 null。
   * @returns Promise<OdmResult<OutputType<T> | null>>
   */
  public async findOne(): Promise<OdmResult<OutputType<T> | null>> {
    this.limit(1); // 强制限制只返回 1 条
    this.offset(0); // 从头开始
    const [err, result] = await this.exec();
    if (err) {
      return errorResult(err);
    }
    const { rows, totalCount } = result as any;
    if (!rows || rows.length === 0) {
      return successResult(null);
    }
    return successResult(rows[0]);
  }

  /**
   * 设置查询结果的排序规则。
   * 可以多次调用以添加多个排序字段。
   * @param sorters - 一个或多个 Tablestore.Sorter 对象数组。
   * @param replace - 是否替换所有现有排序规则（默认 false，即追加）。
   */
  public sortBy(sorters: Tablestore.Sorter[], replace: boolean = false): this {
    return this;
  }

  /**
   * 添加一个排序字段。更便捷的 sortBy 方法。
   * @param field - 要排序的字段名 (必须在 Search Index 中存在且开启排序)。
   * @param order - 'ASC' 或 'DESC'。
   * @param mode - 排序模式 (如 'AVG', 'MIN', 'MAX')，用于多值字段。
   */
  public addSortField(
    field: string,
    order: "ASC" | "DESC" = "ASC",
    mode?: "AVG" | "MIN" | "MAX" | "SUM"
  ) {}

  /**
   * 添加按主键排序。
   * @param order - 'ASC' 或 'DESC'。
   */
  public addSortByPrimaryKey(order: "ASC" | "DESC" = "ASC") {}

  /**
   * 添加按相关性得分排序。
   * @param order - 'ASC' 或 'DESC' (通常 'DESC' 表示最相关的在前)。
   */
  public addSortByScore(order: "ASC" | "DESC" = "DESC") {}

  // --- 私有辅助方法 ---

  /** 验证字段是否是 Search Index 中的可排序字段 */
  private validateSorterField(sorter: Tablestore.Sorter): void {}

  /** 验证字段是否是 Search Index 中的可获取字段 (索引字段或存储字段) */
  private validateSelectableField(fieldName: string): void {}
}
