// src/type-converter.ts
import * as Tablestore from "tablestore";
import {
  z,
  ZodArray,
  ZodBigInt,
  ZodBoolean,
  ZodDate,
  ZodEnum,
  ZodNumber,
  ZodObject,
  ZodRawShape,
  ZodRecord,
  ZodString,
  ZodTuple,
  ZodTypeAny,
} from "zod";

import { getBaseZodTypeInfo, isZodNumberIntInternal } from "./utils";

/** TableStore SDK putRow/updateRow 期望的列值类型 (近似) */
export type TableStoreCellValue = Tablestore.CellValue;
export type TableStoreVirtualData = Tablestore.VirtualData;
export type TableStoreUpdateOfAttributeColumns =
  Tablestore.UpdateRowParams["updateOfAttributeColumns"];
export type TableStoreRow = Tablestore.Row;
export type TableStorePrimaryKeyInput = Tablestore.PrimaryKeyInput;
export type TableStoreAttributesInput = Tablestore.AttributesInput;

/**
 * Converts a JavaScript value to its corresponding Tablestore CellValue based on the schema type.
 *
 * @param value - The JavaScript value to convert.
 * @param zodTypeName - The Valibot schema type (using 'any' for simplicity here).
 * @returns The corresponding Tablestore.CellValue.
 * @throws If the conversion is not supported or fails.
 */
export function jsToTablestore(
  value: unknown,
  zodType?: ZodTypeAny
): TableStoreCellValue | null | undefined {
  if (!zodType) {
    return value as TableStoreCellValue;
  }
  if (value === null || value === undefined) {
    return undefined;
  }
  const zodTypeInfo = getBaseZodTypeInfo(zodType);
  const zodTypeName = zodTypeInfo._def.typeName;
  // 转换逻辑
  switch (zodTypeName) {
    case ZodEnum.name:
      return value as string;
    case ZodString.name:
      return value as string;
    case ZodNumber.name:
      if (isZodNumberIntInternal(zodTypeInfo as ZodNumber)) {
        return Tablestore.Long.fromNumber(value as number);
      } else {
        return Number(value);
      }
    case ZodBoolean.name:
      return Boolean(value);
    case ZodBigInt.name: // 处理 BigInt
      return Tablestore.Long.fromNumber(value as number);
    case ZodDate.name:
      const _val = (value as Date).getTime();
      return Tablestore.Long.fromNumber(_val);
    case ZodArray.name:
    case ZodTuple.name:
    case ZodObject.name:
    case ZodRecord.name:
      return JSON.stringify(value);
    default:
      return value as TableStoreCellValue;
  }
}

/**
 * Converts a Tablestore CellValue back to its JavaScript representation based on the schema type.
 *
 * @param value - The Tablestore.CellValue to convert.
 * @param zodTypeName - The Valibot schema type (using 'any' for simplicity).
 * @returns The corresponding JavaScript value.
 * @throws If the conversion is not supported or fails.
 */

export function tablestoreToJs(
  value: TableStoreCellValue | TableStoreVirtualData | null | undefined,
  zodTypeName: ZodTypeAny
) {
  if (value === null || value === undefined || !zodTypeName) {
    return value;
  }
  if (value === Tablestore.INF_MIN || value === Tablestore.INF_MAX) {
    return value.toString();
  }
  const baseType = getBaseZodTypeInfo(zodTypeName);
  const typeName = baseType._def.typeName;
  const localValue = value.toLocaleString();
  // 转换逻辑
  switch (typeName) {
    case ZodString.name:
      return String(localValue);
    case ZodNumber.name:
      return z.number().safeParse(Number(localValue)).data;
    case ZodBoolean.name:
      return z.boolean().safeParse(Boolean(localValue)).data;
    case ZodBigInt.name:
      return z.bigint().safeParse(Number(localValue)).data;
    case ZodDate.name:
      return z.date().safeParse(new Date(localValue)).data;
    case ZodArray.name:
    case ZodTuple.name:
    case ZodObject.name:
    case ZodRecord.name:
      try {
        return JSON.parse(localValue);
      } catch (e) {
        return value;
      }
    default:
      return value;
  }
}
