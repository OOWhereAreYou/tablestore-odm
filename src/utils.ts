// src/common.ts (或 src/utils.ts)
import { ZodDefault, ZodEffects, ZodNullable, ZodNumber, ZodOptional, ZodTypeAny } from "zod";

/**
 * ODM 操作结果类型，借鉴 Rust 的 Result<T, E> 风格。
 * 元组的第一个元素是错误对象 (如果发生错误)，否则为 null。
 * 元组的第二个元素是成功时的结果 (如果成功)，否则为 null。
 *
 * @template TResult 成功时的结果类型。
 * @template TError 错误时的错误类型 (默认为 Error)。
 */
export type OdmResult<TResult, TError = Error> = [TError | null, TResult | null];

/**
 * 执行一个异步的 Tablestore SDK 调用，并将其结果包装在 OdmResult 元组中。
 * 捕获执行过程中的任何异常。
 *
 * @template TSuccessData SDK 调用成功时 Promise 解析的值的类型。
 * @param sdkCall 一个返回 Promise<TSuccessData> 的异步函数 (例如 () => client.putRow(params))。
 * @returns Promise<OdmResult<TSuccessData>> 包含结果或错误的 Promise。
 */
export async function executeSdkCall<TSuccessData>(
  sdkCall: () => Promise<TSuccessData>
): Promise<OdmResult<TSuccessData>> {
  try {
    const result = await sdkCall();
    return [null, result]; // 成功：[null, 结果]
  } catch (error) {
    // 确保返回的是一个 Error 实例
    if (error instanceof Error) {
      return [error, null]; // 失败：[错误, null]
    } else {
      // 如果捕获到的不是 Error 实例，包装一下
      return [new Error(`An unknown error occurred: ${String(error)}`), null];
    }
  }
}

/**
 * 创建一个表示成功的 OdmResult。
 * @param data 成功的结果数据。
 */
export function successResult<TResult>(data: TResult): OdmResult<TResult, any> {
  return [null, data];
}

/**
 * 创建一个表示失败的 OdmResult。
 * @param error 错误对象。
 */
export function errorResult<TError extends Error>(error: TError): OdmResult<any, TError> {
  return [error, null];
}

/**
 * 获取 Zod 类型的核心基础类型，剥离 Optional, Nullable, Effects, Default 包装器。
 * @param type - 任何 Zod Schema 类型
 * @returns 包含基础类型
 */
export function getBaseZodTypeInfo(type: ZodTypeAny) {
  let currentType = type;
  // 使用 while 循环剥离不确定层数的包装器
  while (true) {
    if (currentType instanceof ZodOptional) {
      currentType = currentType.unwrap();
    } else if (currentType instanceof ZodNullable) {
      currentType = currentType.unwrap();
    } else if (currentType instanceof ZodDefault) {
      currentType = currentType._def.innerType; // 获取默认值内部的类型
    } else if (currentType instanceof ZodEffects) {
      // 深入 Effect 类型 (transform, refine, preprocess 等)
      currentType = currentType._def.schema;
    } else {
      break; // 到达无法继续剥离的基础类型或其他结构类型
    }
  }
  return currentType;
}

/**
 * 判断一个 ZodNumber Schema 是否明确要求为整数 (使用了 .int())
 * @param schema - ZodNumber Schema (应该是已经剥离包装器的基础类型)
 * @returns 如果包含 .int() 约束，则返回 true；否则返回 false。
 */
export function isZodNumberIntInternal(schema: ZodNumber): boolean {
  const checks = schema._def?.checks;
  if (Array.isArray(checks)) {
    return checks.some((check) => check.kind === "int");
  }
  return false;
}
