import * as Tablestore from 'tablestore';
import * as v from 'valibot';

import {
  jsToTablestore,
  tablestoreToJs,
} from '../src/type-converter';

// 重新定义辅助类型，用于测试中的类型断言
type TablestoreLongLike = {
  toNumber: () => number;
  toBigInt?: () => bigint;
  toString: () => string;
};

describe("jsToTablestore Function", () => {
  // --- Basic Type Conversions ---

  it("should convert string to string", () => {
    const schema = v.string();
    expect(jsToTablestore("hello", schema)).toBe("hello");
  });

  it("should convert number to double (number)", () => {
    const schema = v.number(); // Default number schema
    expect(jsToTablestore(123.45, schema)).toBe(123.45);
  });

  it("should convert integer number to Tablestore.Long", () => {
    // Need to use pipe with v.integer() to indicate intent
    const schema = v.pipe(v.number(), v.integer());
    const result = jsToTablestore(123, schema);
    expect(result).toBeInstanceOf(Tablestore.Long);
    expect((result as TablestoreLongLike).toNumber()).toBe(123);
  });

  it("should convert non-integer number with integer pipe to double (number)", () => {
    // Even if pipe has integer, non-integer value remains double
    const schema = v.pipe(v.number(), v.integer());
    expect(jsToTablestore(123.7, schema)).toBe(123.7);
  });

  it("should convert boolean to boolean", () => {
    const schema = v.boolean();
    expect(jsToTablestore(true, schema)).toBe(true);
    expect(jsToTablestore(false, schema)).toBe(false);
  });

  it("should convert Date to Tablestore.Long (timestamp)", () => {
    const schema = v.date();
    const date = new Date();
    const timestamp = date.getTime();
    const result = jsToTablestore(date, schema);
    expect(result).toBeInstanceOf(Tablestore.Long);
    expect((result as TablestoreLongLike).toNumber()).toBe(timestamp);
  });

  it("should convert Buffer to Buffer", () => {
    const schema = v.blob(); // Valibot's blob schema
    const buffer = Buffer.from("test buffer");
    expect(jsToTablestore(buffer, schema)).toBe(buffer);
  });

  it("should convert Uint8Array to Buffer", () => {
    const schema = v.blob();
    const uint8 = new Uint8Array([1, 2, 3]);
    const result = jsToTablestore(uint8, schema);
    expect(result).toBeInstanceOf(Buffer);
    expect(Buffer.from(uint8).equals(result as Buffer)).toBe(true);
  });

  it("should convert bigint to Tablestore.Long", () => {
    const schema = v.bigint();
    const bigIntValue = BigInt("1234567890123456789");
    const result = jsToTablestore(bigIntValue, schema);
    expect(result).toBeInstanceOf(Tablestore.Long);
    expect((result as TablestoreLongLike).toString()).toBe(bigIntValue.toString());
  });

  // --- Error Handling & Edge Cases ---

  it("should throw error for type mismatch (e.g., string for number schema)", () => {
    const schema = v.number();
    expect(() => jsToTablestore("not a number", schema)).toThrow(/期望 number 类型/);
  });

  it("should throw error for unsupported schema type", () => {
    const schema = v.enum_({ key: "value" }); // Example unsupported type
    expect(() => jsToTablestore("value", schema)).toThrow(/不支持的 Schema 类型/);
  });

  it("should throw error converting Blob directly", () => {
    const schema = v.blob();
    const blob = new Blob(["test"]);
    // Check if Blob exists in the environment before testing
    if (typeof Blob !== "undefined") {
      expect(() => jsToTablestore(blob, schema)).toThrow(/不支持直接将 Blob/);
    } else {
      console.warn("Skipping Blob conversion test as Blob is not defined in this environment.");
    }
  });

  // --- null/undefined Handling ---

  it("should return null for null input with nullable schema", () => {
    const schema = v.nullable(v.string());
    expect(jsToTablestore(null, schema)).toBeNull();
  });

  it("should return null for undefined input with optional schema", () => {
    const schema = v.optional(v.string());
    expect(jsToTablestore(undefined, schema)).toBeNull();
  });

  it("should return null for null input with optional schema", () => {
    // Optional schemas implicitly allow undefined, but how about null?
    // Current implementation returns null for both if wrapper allows it.
    const schema = v.optional(v.string());
    expect(jsToTablestore(null, schema)).toBeNull();
  });

  it("should throw error for null input with non-nullable/non-optional schema", () => {
    const schema = v.string();
    expect(() => jsToTablestore(null, schema)).toThrow(/不能将 null\/undefined/);
  });

  it("should throw error for undefined input with non-nullable/non-optional schema", () => {
    const schema = v.string();
    expect(() => jsToTablestore(undefined, schema)).toThrow(/不能将 null\/undefined/);
  });

  // --- Complex Type Conversion (JSON Stringify) ---

  it("should convert array to JSON string", () => {
    const schema = v.array(v.number());
    const array = [1, 2, 3];
    expect(jsToTablestore(array, schema)).toBe(JSON.stringify(array));
  });

  it("should convert object to JSON string", () => {
    const schema = v.object({ a: v.string(), b: v.number() });
    const obj = { a: "test", b: 123 };
    expect(jsToTablestore(obj, schema)).toBe(JSON.stringify(obj));
  });

  // --- Wrapped Type Handling ---

  it("should handle optional schema correctly for valid input", () => {
    const schema = v.optional(v.string());
    expect(jsToTablestore("optional string", schema)).toBe("optional string");
  });

  it("should handle nullable schema correctly for valid input", () => {
    const schema = v.nullable(v.number());
    expect(jsToTablestore(456, schema)).toBe(456);
  });

  it("should handle pipe schema correctly (uses first schema for conversion)", () => {
    const schema = v.pipe(v.string(), v.minLength(5)); // Base type is string
    expect(jsToTablestore("long enough", schema)).toBe("long enough");
    const intSchema = v.pipe(v.number(), v.integer()); // Base type is number, should be Long
    const result = jsToTablestore(789, intSchema);
    expect(result).toBeInstanceOf(Tablestore.Long);
    expect((result as TablestoreLongLike).toNumber()).toBe(789);
  });

  it("should handle fallback schema correctly (uses wrapped schema for conversion)", () => {
    // Fallback value doesn't affect conversion type
    const schema = v.fallback(v.boolean(), false);
    expect(jsToTablestore(true, schema)).toBe(true);
  });
});

describe("tablestoreToJs 函数", () => {
  // --- 基本类型转换 ---

  it("应该将 string (STRING) 转换为 string", () => {
    const schema = v.string();
    expect(tablestoreToJs("hello from db", schema)).toBe("hello from db");
  });

  it("应该将 number (DOUBLE) 转换为 number", () => {
    const schema = v.number();
    expect(tablestoreToJs(123.45, schema)).toBe(123.45);
  });

  it("应该将 Tablestore.Long (INTEGER) 转换为 number", () => {
    const schema = v.pipe(v.number(), v.integer());
    const longValue = Tablestore.Long.fromNumber(123);
    expect(tablestoreToJs(longValue, schema)).toBe(123);
  });

  it("应该将 boolean (BOOLEAN) 转换为 boolean", () => {
    const schema = v.boolean();
    expect(tablestoreToJs(true, schema)).toBe(true);
    expect(tablestoreToJs(false, schema)).toBe(false);
  });

  it("应该将 Tablestore.Long (时间戳) 转换为 Date", () => {
    const schema = v.date();
    const date = new Date();
    const timestamp = date.getTime();
    const longValue = Tablestore.Long.fromNumber(timestamp);
    const result = tablestoreToJs(longValue, schema);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getTime()).toBe(timestamp);
  });

  it("应该将 Buffer (BINARY) 转换为 Buffer", () => {
    const schema = v.blob();
    const buffer = Buffer.from("db buffer");
    expect(tablestoreToJs(buffer, schema)).toBe(buffer);
  });

  it("应该将 Tablestore.Long (BigInt) 转换为 bigint", () => {
    const schema = v.bigint();
    const bigIntValue = BigInt("9876543210987654321");
    const longValue = Tablestore.Long.fromString(bigIntValue.toString());
    const result = tablestoreToJs(longValue, schema);
    expect(typeof result).toBe("bigint");
    expect(result).toBe(bigIntValue);
  });

  it("应该将存储为字符串的 bigint 转换为 bigint", () => {
    const schema = v.bigint();
    const bigIntValue = BigInt("9876543210987654321");
    const stringValue = bigIntValue.toString();
    const result = tablestoreToJs(stringValue, schema);
    expect(typeof result).toBe("bigint");
    expect(result).toBe(bigIntValue);
  });

  // --- 复杂类型转换 (JSON Parse) ---
  it("应该将 JSON 字符串 (Array) 转换为 array", () => {
    const schema = v.array(v.number());
    const jsonString = JSON.stringify([10, 20, 30]);
    expect(tablestoreToJs(jsonString, schema)).toEqual([10, 20, 30]);
  });

  it("应该将 JSON 字符串 (Object) 转换为 object", () => {
    const schema = v.object({ key: v.string() });
    const jsonString = JSON.stringify({ key: "value" });
    expect(tablestoreToJs(jsonString, schema)).toEqual({ key: "value" });
  });

  // --- null/undefined Handling ---
  it("应该直接返回 null 输入", () => {
    const schema = v.nullable(v.string());
    expect(tablestoreToJs(null, schema)).toBeNull();
  });

  it("应该直接返回 undefined 输入", () => {
    const schema = v.optional(v.string());
    // Tablestore 不会存储 undefined，但测试函数本身行为
    expect(tablestoreToJs(undefined, schema)).toBeUndefined();
  });

  // --- 类型不匹配和警告处理 ---
  // beforeEach/afterEach 用于管理 console.warn 的 mock
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
  });

  it("当 schema 期望 number 但收到 string 时，应告警并返回原值", () => {
    const schema = v.number();
    const value = "not a number";
    expect(tablestoreToJs(value, schema)).toBe(value);
    expect(console.warn).toHaveBeenCalled();
  });

  it("当 schema 期望 boolean 但收到 number 时，应告警并返回原值", () => {
    const schema = v.boolean();
    const value = 1;
    expect(tablestoreToJs(value, schema)).toBe(value);
    expect(console.warn).toHaveBeenCalled();
  });

  it("当 schema 期望 Date (Long) 但收到 string 时，应告警并返回原值", () => {
    const schema = v.date();
    const value = "not a date";
    expect(tablestoreToJs(value, schema)).toBe(value);
    expect(console.warn).toHaveBeenCalled();
  });

  it("当 schema 期望 blob (Buffer) 但收到 string 时，应告警并返回原值", () => {
    const schema = v.blob();
    const value = "not a buffer";
    expect(tablestoreToJs(value, schema)).toBe(value);
    expect(console.warn).toHaveBeenCalled();
  });

  it("当 schema 期望 bigint (Long/string) 但收到 number 时，应告警并返回原值", () => {
    const schema = v.bigint();
    const value = 12345;
    expect(tablestoreToJs(value, schema)).toBe(value);
    expect(console.warn).toHaveBeenCalled();
  });

  // --- 无效 JSON 处理 ---
  it("当 schema 期望 array 但收到无效 JSON 字符串时，应打印错误并返回原字符串", () => {
    jest.spyOn(console, "error").mockImplementation(() => {}); // Mock console.error
    const schema = v.array(v.string());
    const invalidJson = "{"; // 无效 JSON
    expect(tablestoreToJs(invalidJson, schema)).toBe(invalidJson);
    expect(console.error).toHaveBeenCalled();
    (console.error as jest.Mock).mockRestore(); // 清理 console.error 的 mock
  });

  it("当 schema 期望 object 但收到无效 JSON 字符串时，应打印错误并返回原字符串", () => {
    jest.spyOn(console, "error").mockImplementation(() => {}); // Mock console.error
    const schema = v.object({ a: v.number() });
    const invalidJson = "[1, 2"; // 无效 JSON
    expect(tablestoreToJs(invalidJson, schema)).toBe(invalidJson);
    expect(console.error).toHaveBeenCalled();
    (console.error as jest.Mock).mockRestore(); // 清理 console.error 的 mock
  });

  // --- 包装类型处理 ---
  it("应该正确处理 optional schema (使用基础类型转换)", () => {
    const schema = v.optional(v.string());
    expect(tablestoreToJs("optional value", schema)).toBe("optional value");
  });

  it("应该正确处理 nullable schema (使用基础类型转换)", () => {
    const schema = v.nullable(v.number());
    const longValue = Tablestore.Long.fromNumber(999);
    expect(tablestoreToJs(longValue, schema)).toBe(999);
  });

  it("应该正确处理 pipe schema (使用基础类型转换)", () => {
    const schema = v.pipe(v.string(), v.email());
    expect(tablestoreToJs("test@example.com", schema)).toBe("test@example.com");
    const intSchema = v.pipe(v.number(), v.integer());
    const longValue = Tablestore.Long.fromNumber(100);
    expect(tablestoreToJs(longValue, intSchema)).toBe(100);
  });

  it("应该正确处理 fallback schema (使用基础类型转换)", () => {
    const schema = v.fallback(v.date(), new Date());
    const date = new Date();
    const longValue = Tablestore.Long.fromNumber(date.getTime());
    const result = tablestoreToJs(longValue, schema);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getTime()).toBe(date.getTime());
  });
});
