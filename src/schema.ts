import * as Tablestore from "tablestore";
import * as zod from "zod";

import {
  jsToTablestore,
  TableStoreAttributesInput,
  TableStorePrimaryKeyInput,
  TableStoreRow,
  tablestoreToJs,
  TableStoreUpdateOfAttributeColumns,
} from "./type-converter";

type EnumValues<T> = T[keyof T];
export type BaseZod = zod.ZodObject<zod.ZodRawShape>;

export type KeyAllowed<T extends BaseZod> = Array<SchemaKey<T>>;

export type SchemaKey<T extends BaseZod> = keyof zod.infer<T>;

export type DefinitionArr = {
  name: string;
  schema?: zod.ZodTypeAny;
  value: unknown;
  isPrimaryKey?: boolean;
  isExist?: boolean;
}[];

export type InputType<T extends BaseZod> = zod.input<T>;
export type OutputType<T extends BaseZod> = zod.output<T> & {
  createdAt?: number;
  updatedAt?: number;
  // uid: string;
};

export type JavaScriptArr = {
  name: string;
  schema?: zod.ZodTypeAny;
  value: unknown;
  isPrimaryKey?: boolean;
  isExist?: boolean;
}[];

// GSI 定义接口
export interface GsiDefinition<T extends BaseZod> {
  /** 索引的名称 (必须与 Tablestore 中创建的索引名称一致) */
  indexName: string;
  /** 构成此 GSI 主键的列名数组 (按顺序) */
  primaryKeys: KeyAllowed<T>;
  /**
   * 可选：定义投影到此 GSI 的列。
   * 'ALL' 表示投影所有主表列 (成本较高)。
   * 字符串数组表示仅投影指定列 (除了 GSI 主键列，它们总是被包含)。
   * 省略或 undefined 可能表示仅包含 GSI 主键 (默认行为，取决于 Tablestore)。
   * 明确定义有助于 ODM 进行 select 校验。
   */
  definedColumn?: "ALL" | KeyAllowed<T>;
}

export const FieldType = Tablestore.FieldType;
export const SortOrder = Tablestore.SortOrder;

type FieldSchemas<T extends BaseZod> = {
  fieldName: SchemaKey<T>;
  fieldType: EnumValues<typeof FieldType>;
  index?: boolean;
  analyzer?: string;
  enableSortAndAgg?: boolean;
  store?: boolean;
  isAnArray?: boolean;
  fieldSchemas?: FieldSchemas<T>[];
  dateFormats?: string;
};

type SearchIndexPramas = Tablestore.CreateSearchIndexParams;

// searchIndex 定义接口
export interface SearchIndexDefinition<T extends BaseZod> {
  /** 索引的名称 (必须与 Tablestore 中创建的索引名称一致) */
  indexName: string;
  indexSetting: {
    schema: {
      fieldSchemas: FieldSchemas<T>[];
      indexSetting?: SearchIndexPramas["schema"]["indexSetting"];
    };
    indexSort?: SearchIndexPramas["schema"]["indexSort"];
    timeToLive?: number;
  };
}

/**
 * Schema 配置选项。
 */
export interface SchemaOptions<T extends BaseZod> {
  /**
   * 主键字段名称列表，必须与 Tablestore 表定义一致。
   */
  primaryKeys: KeyAllowed<T>;
  /**
   * 是否自动管理时间戳字段 (`createdAt`, `updatedAt`)。
   */
  timestamps?: boolean;
  /**
   * 可选：定义与此 Schema 关联的全局二级索引
   */
  GSIs?: ReadonlyArray<GsiDefinition<T>>;
  /**
   * 可选：定义与此 Schema 关联的多元索引
   */
  searchIndexes?: ReadonlyArray<SearchIndexDefinition<T>>;
}

export class DbSchema<T extends BaseZod> {
  /** Zod Schema 定义 */
  public readonly definition: T;
  /** 主键字段名列表 */
  public readonly primaryKeys: KeyAllowed<T>;
  /** 所有字段名列表 */
  public readonly difinitionKeys: KeyAllowed<T>;
  /** 属性值名列表 */
  public readonly attributeKeys: KeyAllowed<T>;
  /** 其他配置选项 */
  public readonly options: SchemaOptions<T>;
  /** 全局二级索引定义 */
  public readonly GSIs: GsiDefinition<T>[] = [];
  /** 多元索引定义 */
  public readonly searchIndexs: SearchIndexDefinition<T>[] = [];
  /** 时间戳 */
  public readonly timestamps: boolean;

  /** 初始化 Schema */
  private _init(denitions: T, options: SchemaOptions<T>) {
    const {
      primaryKeys = [],
      timestamps = true,
      GSIs: globalSecondaryIndexes,
    } = options;
    const primaryErrMsg: string[] = [];
    // 1. 校验 primaryKeys
    if (!primaryKeys || primaryKeys.length === 0) {
      primaryErrMsg.push("主键不能为空");
    }
    const definitionKeys = Object.keys(denitions.shape) as KeyAllowed<T>;
    for (const pk of primaryKeys) {
      if (!definitionKeys.includes(pk)) {
        primaryErrMsg.push(`主键 "${pk.toString()}" 不在 Schema 中`);
      }
    }
    // 2. 校验 GSI
    if (globalSecondaryIndexes) {
      for (const gsi of globalSecondaryIndexes) {
        const gsiPks = gsi.primaryKeys;
        const errGsiPks = gsiPks.filter((pk) => !definitionKeys.includes(pk));
        if (errGsiPks.length > 0) {
          primaryErrMsg.push(
            `GSI "${gsi.indexName}" 主键 "${errGsiPks.join(
              ", "
            )}" 不在 Schema 中`
          );
        }
      }
    }
    // 3. 校验 searchIndexs
    if (options.searchIndexes) {
      for (const si of options.searchIndexes) {
        const siPks = si.indexSetting.schema.fieldSchemas.map(
          (fs) => fs.fieldName
        );
        const errSiPks = siPks.filter((pk) => !definitionKeys.includes(pk));
        if (errSiPks.length > 0) {
          primaryErrMsg.push(
            `SearchIndex "${si.indexName}" 主键 "${errSiPks.join(
              ", "
            )}" 不在 Schema 中`
          );
        }
      }
    }
    if (primaryErrMsg.length > 0) {
      throw new Error(primaryErrMsg.join("\n"));
    }
  }

  constructor(schema: T, options: SchemaOptions<T>) {
    this.definition = schema;
    this.options = options;
    this._init(schema, options);
    // 初始化 primaryKeys, attributeKeys, timestamps (简化)
    this.primaryKeys = options.primaryKeys;
    const definitionKeys = Object.keys(schema.shape) as SchemaKey<T>[];
    this.attributeKeys = definitionKeys.filter(
      (key) => !this.primaryKeys.includes(key)
    );
    this.timestamps = options.timestamps ?? true;
    this.difinitionKeys = definitionKeys;
    this.GSIs = options.GSIs ? ([...options.GSIs] as GsiDefinition<T>[]) : [];
    this.searchIndexs = options.searchIndexes
      ? ([...options.searchIndexes] as SearchIndexDefinition<T>[])
      : [];
  }

  // 转换为 Tablestore 数组
  public convertToTablestorePks(input: InputType<T>, gsiIndexName?: string) {
    let _primaryKeys = [...this.primaryKeys];
    const _errKeys: KeyAllowed<T> = [];
    const _output: TableStorePrimaryKeyInput = [];
    if (gsiIndexName) {
      const gsiPks = this.getGsiPks(gsiIndexName);
      _primaryKeys = [...new Set([...gsiPks, ..._primaryKeys])];
    }

    for (const key of _primaryKeys) {
      const _value = input[key];
      const _schema = this.getFieldSchema(key);
      const _parsedValue = jsToTablestore(_value, _schema);
      if (_parsedValue === null || _parsedValue === undefined) {
        _errKeys.push(key);
        continue;
      }
      _output.push({
        [key]: _parsedValue,
      });
    }
    return {
      output: _output,
      missingKeys: _errKeys,
      error:
        _errKeys.length > 0
          ? new Error(`缺少主键字段: ${_errKeys.join(", ")}`)
          : null,
    };
  }
  public convertToTablestoreAttributes(input: InputType<T>) {
    const _attributeKeys = this.attributeKeys;
    const _errKeys: KeyAllowed<T> = [];
    const _output: TableStoreAttributesInput = [];
    for (const key of _attributeKeys) {
      const _value = input[key];
      const _schema = this.getFieldSchema(key);
      const _parsedValue = _schema.safeParse(_value);
      if (_parsedValue.success) {
        if (!_parsedValue.data) {
          continue;
        }
        _output.push({
          [key]: jsToTablestore(_parsedValue.data, _schema),
        });
      } else {
        _errKeys.push(key);
      }
    }
    return {
      output: _output,
      error:
        _errKeys.length > 0
          ? new Error(`缺少属性字段: ${_errKeys.join(", ")}`)
          : null,
    };
  }
  public convertToTablestoreUpdates(input: InputType<T>) {
    const _attributeKeys = this.attributeKeys;
    const _errKeys: KeyAllowed<T> = [];
    const _output: TableStoreUpdateOfAttributeColumns = [];
    for (const key of _attributeKeys) {
      // 更新的时候，如果需要维护时间戳，则修改 updatedAt 字段
      if (key == "updatedAt" && this.timestamps) {
        _output.push({
          PUT: [{ [key]: jsToTablestore(Date.now(), zod.number().int()) }],
        });
        continue;
      }
      const isExist = Object.prototype.hasOwnProperty.call(input, key);
      // 如果属性不存在，则跳过
      if (!isExist) {
        continue;
      }
      const _value = input[key];
      // 如果属性存在且为 null 或 undefined，删除
      if (isExist && (_value === undefined || _value === null)) {
        _output.push({
          DELETE_ALL: [key.toString()],
        });
        continue;
      }
      const _schema = this.getFieldSchema(key);
      const _parsedValue = _schema.safeParse(_value);
      if (_parsedValue.success) {
        _output.push({
          PUT: [{ [key]: jsToTablestore(_value, _schema) }],
        });
      } else {
        _errKeys.push(key);
      }
    }
    return {
      output: _output,
      error:
        _errKeys.length > 0
          ? new Error(`缺少属性字段: ${_errKeys.join(", ")}`)
          : null,
    };
  }
  // 转化为 JavaScript 合法值
  public convertToJs(
    input: TableStoreRow | null | undefined
  ): OutputType<T> | undefined {
    if (!input) {
      return;
    }
    const _output: Record<string, unknown> = {};
    const { primaryKey, attributes } = input;
    if (primaryKey) {
      for (const pk of primaryKey) {
        const name = pk.name;
        const value = pk.value;
        const schema = this.getFieldSchema(name);
        const parsedValue = tablestoreToJs(value, schema);
        if (parsedValue === null || parsedValue === undefined) {
          continue;
        }
        _output[name] = parsedValue;
      }
    }
    if (attributes) {
      for (const attr of attributes) {
        const name = attr.columnName;
        const value = attr.columnValue;
        const schema = this.getFieldSchema(name);
        const parsedValue = tablestoreToJs(value, schema);
        if (parsedValue === null || parsedValue === undefined) {
          continue;
        }
        _output[name] = parsedValue;
      }
    }

    return _output as OutputType<T>;
  }
  public convertPksTojs(input?: TableStoreRow["primaryKey"]) {
    if (!input) {
      return;
    }
    let _output: Record<string, unknown> = {};
    for (const pk of input) {
      const name = pk.name;
      const value = pk.value;
      const schema = this.getFieldSchema(name);
      const parsedValue = tablestoreToJs(value, schema);
      if (parsedValue === null || parsedValue === undefined) {
        continue;
      }
      _output[name] = parsedValue;
    }
    return _output as InputType<T>;
  }

  // 解析input为合法的input
  public parse(input: InputType<T>) {
    const { error: pksErr, output: pks } = this.parsePks(input);
    const { error: attrsErr, output: attrs } = this.parseAttrs(input);
    return {
      error: pksErr || attrsErr,
      primaryKeys: pks,
      attributes: attrs,
      output: {
        ...pks,
        ...attrs,
      },
    };
  }
  public parsePks(input: InputType<T>) {
    const _primaryKeys = this.primaryKeys;
    const _output: InputType<T> = {};
    let errKeys: KeyAllowed<T> = [];
    for (const key of _primaryKeys) {
      const _value = input[key];
      const _schema = this.getFieldSchema(key);
      const _parsedResult = _schema.safeParse(_value);
      if (_parsedResult.success) {
        _output[key] = _parsedResult.data;
      } else {
        errKeys.push(key);
      }
    }
    return {
      output: _output as InputType<T>,
      error:
        errKeys.length > 0
          ? new Error(`缺少主键字段: ${errKeys.join(", ")}`)
          : null,
    };
  }
  public parseAttrs(input: InputType<T>, ignorNotFound = false) {
    const _attributeKeys = this.attributeKeys;
    const _output: InputType<T> = {};
    let errKeys: KeyAllowed<T> = [];
    for (const key of _attributeKeys) {
      const notExist = !Object.prototype.hasOwnProperty.call(input, key);
      // 如果 ignorNotFound 为 true，则忽略不存在的属性字段
      if (ignorNotFound && notExist) {
        continue;
      }
      const _value = input[key];
      const _schema = this.getFieldSchema(key);
      const _parsedResult = _schema.safeParse(_value);
      if (_parsedResult.success) {
        if (!_parsedResult.data) {
          continue;
        }
        _output[key] = _parsedResult.data;
      } else {
        errKeys.push(key);
      }
    }
    return {
      output: _output as InputType<T>,
      error:
        errKeys.length > 0
          ? new Error(`缺少属性字段: ${errKeys.join(", ")}`)
          : null,
    };
  }

  /**
   * 获取指定字段的 Zod Schema 定义。
   * @param fieldName 字段名称
   * @returns 对应的 Zod Schema 或 undefined
   */
  public getFieldSchema(fieldName: SchemaKey<T>) {
    // Zod 使用 .shape 访问字段定义
    const shape = this.definition.shape as unknown as Record<
      SchemaKey<T>,
      zod.ZodTypeAny
    >;
    return shape[fieldName];
  }

  /**
   * 检查某个字段是否是主键。
   * @param fieldName 要检查的字段名。
   * @returns {boolean} 如果是主键则返回 true，否则返回 false。
   */
  public isPrimaryKey(fieldName: string): boolean {
    return this.primaryKeys.includes(fieldName);
  }

  /**
   * 检查某个字段是否是属性。
   * @param gsiIndexName 二级索引名称。
   * @returns { Array<string> } 返回二级索引的pks。
   */
  public getGsiPks(gsiIndexName: string): KeyAllowed<T> {
    const gsi = this.GSIs.find((g) => g.indexName === gsiIndexName);
    if (!gsi) {
      return [];
    }
    return gsi.primaryKeys;
  }
}

/**
 * 创建 Schema 实例的工厂函数。
 *
 * @param definition Zod Object Schema 定义
 * @param options Schema 配置选项
 * @returns {Schema} Schema 实例
 */
export function createSchema<T extends BaseZod>(
  definition: T,
  options: SchemaOptions<T>
): DbSchema<T> {
  return new DbSchema<T>(definition, options);
}
