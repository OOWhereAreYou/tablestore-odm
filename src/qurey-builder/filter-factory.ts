// src/query-builder/filter-factory.ts
import * as Tablestore from "tablestore";
import { z } from "zod"; // 如果需要 Zod 类型

import { BaseZod, DbSchema, InputType, OutputType } from "../schema"; // 假设类型定义
import { jsToTablestore } from "../type-converter"; // 引入类型转换器

type EnumValues<T> = T[keyof T];
export type ColumnFilterOptions = {
  passIfMissing?: boolean;
  latestVersionOnly?: boolean;
};

/**
 * 用于在 RangeQueryBuilder.filter() 回调中构建 Tablestore ColumnCondition 的工厂类。
 */
export class FilterFactory<T extends BaseZod> {
  private readonly schema: DbSchema<T>;

  constructor(schema: DbSchema<T>) {
    this.schema = schema;
  }

  // --- Private Helper for Single Condition ---
  private createSingleCondition<K extends keyof OutputType<T>>(
    field: K,
    value: InputType<T>[K], // 使用输入类型推断
    comparator: EnumValues<typeof Tablestore.ComparatorType>,
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    const fieldName = field as string;
    const fieldSchema = this.schema.getFieldSchema(fieldName);
    if (!fieldSchema) {
      // 在运行时进行检查，尽管 TypeScript 可能已经捕获
      throw new Error(`字段 "${fieldName}" 在 Schema 定义中不存在。`);
    }

    const columnValue = jsToTablestore(value, fieldSchema);
    if (columnValue === null || columnValue === undefined) {
      // 在运行时进行检查，尽管 TypeScript 可能已经捕获
      throw new Error(`字段 "${fieldName}" 的值不能为 null 或 undefined。`);
    }

    // 使用 SDK 构造函数，注意参数顺序可能依据 SDK 版本
    // 通常是: columnName, columnValue, comparatorType, passIfMissing, latestVersionOnly
    return new Tablestore.SingleColumnCondition(
      fieldName,
      columnValue,
      comparator,
      options?.passIfMissing ?? true, // 使用默认值 true
      options?.latestVersionOnly ?? true // 使用默认值 true
    );
  }

  // --- Comparison Methods (返回 SingleColumnCondition) ---

  /** 等于 (=) */
  public equals<K extends keyof OutputType<T>>(
    field: K,
    value: InputType<T>[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.EQUAL,
      options
    );
  }

  /** 不等于 (!=) */
  public notEqual<K extends keyof OutputType<T>>(
    field: K,
    value: InputType<T>[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.NOT_EQUAL,
      options
    );
  }

  /** 大于 (>) */
  public greaterThan<K extends keyof OutputType<T>>(
    field: K,
    value: InputType<T>[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.GREATER_THAN,
      options
    );
  }

  /** 大于等于 (>=) */
  public greaterThanOrEqual<K extends keyof OutputType<T>>(
    field: K,
    value: InputType<T>[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.GREATER_EQUAL,
      options
    );
  }

  /** 小于 (<) */
  public lessThan<K extends keyof OutputType<T>>(
    field: K,
    value: InputType<T>[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.LESS_THAN,
      options
    );
  }

  /** 小于等于 (<=) */
  public lessThanOrEqual<K extends keyof OutputType<T>>(
    field: K,
    value: InputType<T>[K],
    options?: ColumnFilterOptions
  ): Tablestore.SingleColumnCondition {
    return this.createSingleCondition(
      field,
      value,
      Tablestore.ComparatorType.LESS_EQUAL,
      options
    );
  }

  // --- Logic Methods (返回 CompositeCondition) ---

  /**
   * 逻辑与 (AND)。组合多个条件，所有条件必须满足。
   * @param conditions - 一个或多个 ColumnCondition 对象。
   */
  public and(
    ...conditions: Tablestore.ColumnCondition[]
  ): Tablestore.CompositeCondition {
    if (conditions.length === 0) {
      throw new Error("AND 操作符需要至少一个条件。");
    }
    const composite = new Tablestore.CompositeCondition(
      Tablestore.LogicalOperator.AND
    );
    conditions.forEach((cond) => composite.addSubCondition(cond));
    return composite;
  }

  /**
   * 逻辑或 (OR)。组合多个条件，至少一个条件满足即可。
   * @param conditions - 一个或多个 ColumnCondition 对象。
   */
  public or(
    ...conditions: Tablestore.ColumnCondition[]
  ): Tablestore.CompositeCondition {
    if (conditions.length === 0) {
      throw new Error("OR 操作符需要至少一个条件。");
    }
    const composite = new Tablestore.CompositeCondition(
      Tablestore.LogicalOperator.OR
    );
    conditions.forEach((cond) => composite.addSubCondition(cond));
    return composite;
  }

  /**
   * 逻辑非 (NOT)。对单个条件取反。
   * @param condition - 一个 ColumnCondition 对象。
   */
  public not(
    condition: Tablestore.ColumnCondition
  ): Tablestore.CompositeCondition {
    const composite = new Tablestore.CompositeCondition(
      Tablestore.LogicalOperator.NOT
    );
    composite.addSubCondition(condition); // NOT 通常只接受一个子条件
    return composite;
  }
}
