// src/index.ts

// 导出 Connection 类和配置类型
export { Connection } from "./connection";
export type { OdmConfig } from "./connection";

// 导出 Schema 相关
export { createSchema, DbSchema, FieldType, SortOrder } from "./schema"; // 确保导出 FieldType 和 SortOrder
export type {
  SchemaOptions,
  BaseZod,
  InputType,
  OutputType, // 这个 OutputType 是从 ./schema 导出的
  KeyAllowed,
  SchemaKey,
  DefinitionArr,
  JavaScriptArr,
  GsiDefinition,
  SearchIndexDefinition,
  // FieldSchemas, // 如果需要也导出
} from "./schema";

// 导出 Model 相关
export { createModel } from "./model";
export type {
  Document,
  ModelStatic,
  PlainPrimaryKeyValue,
  PlainPrimaryKeys,
  SaveOptions,
  // OutputType as ModelOutputType, // 如果 model.ts 中的 OutputType 和 schema.ts 中的不一样，给它一个别名
} from "./model";
// 注意：model.ts 中也导出了 OutputType，它直接从 ./schema re-export。所以这里不需要特别处理，除非你想区分。

// 导出 Tablestore SDK (方便用户，但可选)
export * as Tablestore from "tablestore";

// 导出 Query Builders (如果它们是公开 API 的一部分)
export { RangeQueryBuilder } from "./qurey-builder/range-query-builder";
export { SearchQueryBuilder } from "./qurey-builder/search-query-builder";

// 导出工具函数中的 OdmResult 类型 (如果希望用户能直接使用)
export type { OdmResult } from "./utils";
