// test/schema.test.ts
import * as v from 'valibot';

import {
  createSchema,
  Schema,
  SchemaOptions,
} from '../src/schema';

describe("Schema Class and createSchema Function", () => {
  // Basic definition for testing
  const baseDefinition = {
    pk1: v.string(),
    // Correct usage of integer validation with pipe
    pk2: v.pipe(v.number(), v.integer()),
    attr1: v.optional(v.string(), "default"),
    attr2: v.boolean(),
    attr3: v.optional(v.date()),
  };

  const ValibotBaseSchema = v.object(baseDefinition); // Create instance

  const baseOptions: SchemaOptions = {
    primaryKeys: ["pk1", "pk2"],
  };

  const customTimestampOptions: SchemaOptions = {
    primaryKeys: ["id"],
    timestamps: true, // 强制修正为 boolean
  };

  // Mock data matching the base definition
  const baseData = {
    pk1: "ts",
    pk2: 1,
    attr2: true,
  };

  // --- Initialization Tests ---

  it("should create a Schema instance with valid definition and options", () => {
    const schema = createSchema(ValibotBaseSchema, baseOptions); // Use instance
    expect(schema).toBeInstanceOf(Schema);
    expect(schema.definition).toBe(ValibotBaseSchema);
    expect(schema.primaryKeys).toEqual(["pk1", "pk2"]);
    expect(schema.options).toEqual(baseOptions);
    // Check base keys are present in the final definition
    expect(Object.keys(schema.definition.entries)).toEqual(
      expect.arrayContaining(["pk1", "pk2", "attr1", "attr2", "attr3"])
    );
  });

  it("should throw error if primaryKeys are missing or empty in options", () => {
    expect(() => createSchema(ValibotBaseSchema, {} as SchemaOptions)).toThrow(
      // Use instance
      /必须定义 primaryKeys/
    );
    expect(() => createSchema(ValibotBaseSchema, { primaryKeys: [] })).toThrow(
      // Use instance
      /必须定义 primaryKeys/
    );
  });

  it("should throw error if a primaryKey is not in the definition", () => {
    const invalidOptions: SchemaOptions = {
      primaryKeys: ["pk1", "nonExistentKey"],
    };
    expect(() => createSchema(ValibotBaseSchema, invalidOptions)).toThrow(
      // Use instance
      /主键字段 "nonExistentKey" 在 Schema 定义中不存在/
    );
  });

  it("should store options correctly", () => {
    const optionsWithTimestamp: SchemaOptions = {
      primaryKeys: ["pk1", "pk2"],
      timestamps: true,
    };
    const schema = createSchema(ValibotBaseSchema, optionsWithTimestamp); // Use instance
    expect(schema.options.timestamps).toBe(true);
  });

  // --- Timestamps Tests ---

  it("should add createdAt and updatedAt fields when timestamps: true and check parsed output", () => {
    const schema = createSchema(ValibotBaseSchema, {
      ...baseOptions,
      timestamps: true,
    });
    const schemaKeys = Object.keys(schema.definition.entries);
    expect(schemaKeys).toContain("createdAt");
    expect(schemaKeys).toContain("updatedAt");

    // Check parsed output for type
    const sampleData = { pk1: "ts", pk2: 1, attr2: true };
    const parsed = schema.parse(sampleData);
    expect((parsed as any).createdAt).toBeInstanceOf(Date);
    expect((parsed as any).updatedAt).toBeInstanceOf(Date);
  });

  // 明确删除从这里开始的整个 it 块
  /*
  it("should add custom timestamp fields when specified and check parsed output", () => {
    const customTimestampOptions: SchemaOptions = {
      ...baseOptions,
      timestamps: { createdAt: "created_on", updatedAt: "updated_at" }, // Invalid
    };
    const schema = createSchema(ValibotBaseSchema, customTimestampOptions);
    const schemaKeys = Object.keys(schema.definition.entries);
    expect(schemaKeys).toContain("created_on");
    expect(schemaKeys).toContain("updated_at");
    expect(schemaKeys).not.toContain("createdAt");
    expect(schemaKeys).not.toContain("updatedAt");

    // Check parsed output for type
    const sampleData = { pk1: "ts-custom", pk2: 2, attr2: false };
    const parsed = schema.parse(sampleData);
    expect((parsed as any).created_on).toBeInstanceOf(Date);
    expect((parsed as any).updated_at).toBeInstanceOf(Date);
  });
  */
  // 删除结束

  it("should not override existing timestamp fields but add missing ones, check parsed output", () => {
    const definitionWithTimestamps = {
      ...baseDefinition,
      createdAt: v.string(), // Pre-defined createdAt as string
    };
    const schema = createSchema(ValibotBaseSchema, {
      ...baseOptions,
      timestamps: true,
    });
    const schemaKeys = Object.keys(schema.definition.entries);
    expect(schemaKeys).toContain("createdAt");
    expect(schemaKeys).toContain("updatedAt"); // Should still add updatedAt

    // Ensure createdAt is the original one (string) and updatedAt is Date after parsing
    const sampleData = {
      pk1: "ts-mixed",
      pk2: 3,
      attr2: true,
      createdAt: "manual-date-str",
    };
    const parsed = schema.parse(sampleData);
    expect(typeof (parsed as any).createdAt).toBe("string"); // Original type remains string
    expect((parsed as any).updatedAt).toBeInstanceOf(Date); // Added fallback type results in Date
  });

  // --- Key Retrieval Tests ---

  it("should return correct primary keys", () => {
    const schema = createSchema(ValibotBaseSchema, baseOptions);
    expect(schema.primaryKeys).toEqual(["pk1", "pk2"]);
  });

  it("should return correct attribute keys (including added timestamps)", () => {
    // Test without timestamps
    const schema1 = createSchema(ValibotBaseSchema, baseOptions);
    expect(schema1.getAttributeKeys()).toEqual(["attr1", "attr2", "attr3"]);

    // Test with timestamps
    const schema2 = createSchema(ValibotBaseSchema, {
      ...baseOptions,
      timestamps: true,
    });
    // getAttributeKeys should also include the timestamp fields as they are attributes
    expect(schema2.getAttributeKeys()).toEqual(
      expect.arrayContaining(["attr1", "attr2", "attr3", "createdAt", "updatedAt"])
    );
    expect(schema2.getAttributeKeys().length).toBe(5); // Ensure no extra keys
  });

  // --- Parsing Tests ---

  it("should parse valid data successfully", () => {
    const schema = createSchema(ValibotBaseSchema, baseOptions);
    const data = { pk1: "test", pk2: 123, attr2: true };
    const expected = {
      pk1: "test",
      pk2: 123,
      attr1: "default",
      attr2: true,
      attr3: undefined,
    };
    expect(schema.parse(data)).toEqual(expected);
  });

  it("should parse valid data with timestamps and apply defaults", () => {
    const schema = createSchema(ValibotBaseSchema, {
      ...baseOptions,
      timestamps: true,
    });
    const data = { pk1: "ts-test", pk2: 456, attr2: false };
    const result = schema.parse(data);

    expect(result.pk1).toBe("ts-test");
    expect(result.pk2).toBe(456);
    expect(result.attr1).toBe("default");
    expect(result.attr2).toBe(false);
    // Use type assertion to access timestamp fields for testing
    expect((result as any).createdAt).toBeInstanceOf(Date);
    expect((result as any).updatedAt).toBeInstanceOf(Date);
    // Check if dates are recent (within a small threshold)
    const now = Date.now();
    expect((result as any).createdAt.getTime()).toBeGreaterThanOrEqual(now - 1000);
    expect((result as any).createdAt.getTime()).toBeLessThanOrEqual(now + 1000);
  });

  it("should throw ValiError on invalid data using parse()", () => {
    const schema = createSchema(ValibotBaseSchema, baseOptions);
    const invalidData = { pk1: "test", pk2: "not-a-number", attr2: true }; // pk2 is wrong type
    expect(() => schema.parse(invalidData)).toThrow(v.ValiError);
    try {
      schema.parse(invalidData);
    } catch (error) {
      if (error instanceof v.ValiError) {
        expect(error.issues.length).toBeGreaterThan(0);
        expect(error.issues[0].path?.[0].key).toBe("pk2"); // Check if error is related to pk2
      } else {
        throw error; // Re-throw if it's not a ValiError
      }
    }
  });

  it("should return success: true for valid data using safeParse()", () => {
    const schema = createSchema(ValibotBaseSchema, baseOptions);
    const data = { pk1: "safe-test", pk2: 789, attr2: false };
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      // result.output should have the correct inferred type here
      expect(result.output).toEqual({
        pk1: "safe-test",
        pk2: 789,
        attr1: "default",
        attr2: false,
        attr3: undefined,
      });
    }
  });

  it("should return success: false and issues for invalid data using safeParse()", () => {
    const schema = createSchema(ValibotBaseSchema, baseOptions);
    const invalidData = { pk1: 123, pk2: 789, attr2: false }; // pk1 is wrong type
    const result = schema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].path?.[0].key).toBe("pk1");
    }
  });

  it("should strip keys not defined in the schema during parsing", () => {
    const schema = createSchema(ValibotBaseSchema, baseOptions);
    const data = {
      pk1: "strip",
      pk2: 1,
      attr2: true,
      extraKey: "should be removed",
    };
    const result = schema.parse(data);
    expect(result).not.toHaveProperty("extraKey");
    expect(result).toEqual({
      pk1: "strip",
      pk2: 1,
      attr1: "default",
      attr2: true,
      attr3: undefined,
    });

    const safeResult = schema.safeParse(data);
    expect(safeResult.success).toBe(true);
    if (safeResult.success) {
      expect(safeResult.output).not.toHaveProperty("extraKey");
      expect(safeResult.output).toEqual({
        pk1: "strip",
        pk2: 1,
        attr1: "default",
        attr2: true,
        attr3: undefined,
      });
    }
  });

  // Timestamps tests - need to adjust for boolean option
  describe("Timestamps option", () => {
    const customTimestampOptionsForWarningTest: SchemaOptions = {
      primaryKeys: ["pk1", "pk2"], // 使用 ValibotBaseSchema 中存在的键
      timestamps: true,
    };

    it("should log (previously warn) if timestamps option is true but fields are missing in definition", () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      // 使用修改后的 options
      createSchema(ValibotBaseSchema, customTimestampOptionsForWarningTest);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("自动为 Schema 添加 'createdAt' 字段")
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("自动为 Schema 添加 'updatedAt' 字段")
      );
      logSpy.mockRestore();
    });

    it("should warn (not log) if timestamps option is true and fields exist in definition", () => {
      const definitionWithTimestamps = {
        ...baseDefinition,
        createdAt: v.optional(v.date()),
        updatedAt: v.optional(v.string()),
      };
      const ValibotSchemaWithTimestamps = v.object(definitionWithTimestamps);
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      createSchema(ValibotSchemaWithTimestamps, {
        primaryKeys: ["pk1", "pk2"],
        timestamps: true,
      });
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Schema 定义中已存在 "createdAt" 字段')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Schema 定义中已存在 "updatedAt" 字段')
      );
      expect(logSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  // Schema methods tests
  describe("Schema instance methods", () => {
    const schema = createSchema(ValibotBaseSchema, baseOptions); // Use instance

    it("parse() should validate data using the definition", () => {
      const validData = { pk1: "abc", pk2: 123, attr2: true };
      expect(() => schema.parse(validData)).not.toThrow();
      const parsed = schema.parse(validData);
      expect(parsed.attr1).toBe("default"); // Check default value

      const invalidData = { pk1: "abc", pk2: "not a number" };
      expect(() => schema.parse(invalidData)).toThrow(v.ValiError);
    });

    it("isPrimaryKey() should return true for primary keys, false otherwise", () => {
      expect(schema.isPrimaryKey("pk1")).toBe(true);
      expect(schema.isPrimaryKey("pk2")).toBe(true);
      expect(schema.isPrimaryKey("attr1")).toBe(false);
      expect(schema.isPrimaryKey("nonExistent")).toBe(false);
    });

    it("getFieldSchema() should return the correct Valibot schema for a field", () => {
      expect(schema.getFieldSchema("pk1")).toBe(baseDefinition.pk1);
      expect(schema.getFieldSchema("attr1")).toBe(baseDefinition.attr1);
      expect(schema.getFieldSchema("nonExistent")).toBeUndefined();
    });

    it("getPrimaryKeyDefinitions() should return correct definitions", () => {
      const pkDefs = schema.getPrimaryKeyDefinitions();
      expect(pkDefs).toHaveLength(2);
      expect(pkDefs[0]).toMatchObject({ name: "pk1", schema: baseDefinition.pk1 });
      expect(pkDefs[1]).toMatchObject({ name: "pk2", schema: baseDefinition.pk2 });
    });

    it("getAttributeDefinitions() should return correct definitions for attribute columns", () => {
      const attrDefs = schema.getAttributeDefinitions();
      expect(attrDefs).toHaveLength(3);
      expect(attrDefs.map((d) => d.name)).toEqual(["attr1", "attr2", "attr3"]);
    });

    // 新增测试用例，包含 getAttributeKeys 和 safeParse 的测试
    it("getAttributeKeys() and safeParse() should work correctly", () => {
      // 验证 getAttributeKeys 方法 (注意：这里使用的 baseDefinition，可能与之前的字段列表不同)
      expect(schema.getAttributeKeys()).toEqual(["attr1", "attr2", "attr3"]);

      // 验证 safeParse 方法
      const validParseData = { pk1: "safe-parse", pk2: 999, attr2: true };
      expect(schema.safeParse(validParseData).success).toBe(true);

      const invalidParseData = { pk1: 123 }; // Missing pk2, pk1 has wrong type
      const parseResult = schema.safeParse(invalidParseData);
      expect(parseResult.success).toBe(false);
      // 移除 @ts-expect-error, issues 检查可以更明确
      if (!parseResult.success) {
        expect(parseResult.issues.length).toBeGreaterThan(0);
      }
    });
  });
});
