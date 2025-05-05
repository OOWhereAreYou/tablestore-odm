// src/index.ts

// 导出 Connection 类和配置类型
export { Connection } from "./connection";
export type { OdmConfig } from "./connection";

export { createSchema, DbSchema } from "./schema";
export type { SchemaOptions } from "./schema"; // 导出 Schema 类型

export { createModel } from "./model";
export type { Document, ModelStatic } from "./model";

export * as Tablestore from "tablestore";
