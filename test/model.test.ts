import * as Tablestore from "tablestore";
// test/model.test.ts
import * as v from "valibot";

import { Connection, OdmConfig } from "../src/connection";
import { createModel, Document, ModelStatic } from "../src/model";
import { createSchema, Schema, SchemaOptions } from "../src/schema";

// --- Mocks ---

// Mock the Connection class and its getClient method
const mockGetClient = jest.fn();
jest.mock("../src/connection", () => {
  return {
    Connection: jest.fn().mockImplementation((config: OdmConfig) => {
      return {
        config: config,
        getClient: mockGetClient, // Use the mock function here
        // Mock other Connection methods if needed
      };
    }),
    // Export OdmConfig interface if needed by tests
    OdmConfig: jest.fn(),
  };
});

// Mock the Tablestore Client methods we'll use (getRow, putRow etc.)
const mockGetRow = jest.fn();
const mockPutRow = jest.fn();
// Add mocks for other methods like updateRow, deleteRow as needed
mockGetClient.mockReturnValue({
  getRow: mockGetRow,
  putRow: mockPutRow,
  // Add other mocked methods
});

// --- Test Setup ---

describe("Model Class and createModel Function", () => {
  let TestSchema: Schema<v.ObjectSchema<any, any>>;
  let testConnection: Connection;
  let UserModel: ModelStatic<any>; // Use 'any' for TSchema in ModelStatic for simplicity in tests

  const userDefinition = {
    // Use pipe for string validations
    userId: v.pipe(v.string(), v.minLength(1)), // PK1
    orgId: v.pipe(v.number(), v.integer()), // PK2
    name: v.string(),
    // Use pipe within optional for email validation
    email: v.optional(v.pipe(v.string(), v.email())),
    age: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
    isActive: v.optional(v.boolean(), true),
  };
  const userOptions: SchemaOptions = {
    primaryKeys: ["userId", "orgId"],
    timestamps: true, // Enable timestamps
  };

  beforeAll(() => {
    // Create Schema and Connection instances once for all tests
    const ValibotUserSchema = v.object(userDefinition);
    TestSchema = createSchema(ValibotUserSchema, userOptions);
    const mockConfig: OdmConfig = {
      endpoint: "mock",
      accessKeyId: "mock",
      secretAccessKey: "mock",
      instancename: "mock",
    };
    testConnection = new Connection(mockConfig);
    // Create the Model using the factory function
    UserModel = createModel("User", TestSchema, "users_table", testConnection);
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Ensure getClient returns the mock client with methods
    mockGetClient.mockReturnValue({
      getRow: mockGetRow,
      putRow: mockPutRow,
    });
  });

  // --- Basic Model Structure Tests ---

  it("should create a Model with correct static properties", () => {
    expect(UserModel.modelName).toBe("User");
    expect(UserModel.tableName).toBe("users_table");
    expect(UserModel.schema).toBe(TestSchema);
    expect(UserModel.connection).toBe(testConnection);
    expect(UserModel.client).toBeDefined();
    expect(mockGetClient).toHaveBeenCalledTimes(1); // Client should be accessed once
  });

  // --- Document Instantiation Tests ---

  it("should create a Document instance with valid data", () => {
    const userData = { userId: "u-1", orgId: 100, name: "Alice", age: 30 };
    const userDoc = new UserModel(userData);
    expect(userDoc).toBeInstanceOf(Object); // Check if it's an object derived from BaseDocument
    expect(userDoc.toObject()).toMatchObject({
      userId: "u-1",
      orgId: 100,
      name: "Alice",
      age: 30,
      isActive: true, // Default value applied
      // Timestamps will be Date objects
    });
    expect((userDoc as any)._data.createdAt).toBeInstanceOf(Date);
    expect((userDoc as any)._data.updatedAt).toBeInstanceOf(Date);
  });

  it("should throw validation error for invalid data during instantiation", () => {
    const invalidUserData = { userId: "u-2", orgId: 200, name: "Bob", age: -5 }; // Invalid age
    expect(() => new UserModel(invalidUserData)).toThrow(v.ValiError);
  });

  // --- Static Method Tests ---

  describe("UserModel.create()", () => {
    // Mock putRow for create tests (since create now calls save)
    beforeEach(() => {
      mockPutRow.mockResolvedValue({}); // Mock successful putRow
    });

    it("should create a document instance and call save (which calls putRow)", async () => {
      const userData = { userId: "u-3", orgId: 300, name: "Charlie" };
      const userDoc = await UserModel.create(userData);

      expect(userDoc).toBeInstanceOf(Object);
      expect(userDoc.toObject()).toMatchObject({
        userId: "u-3",
        orgId: 300,
        name: "Charlie",
        isActive: true,
      });
      expect((userDoc as any)._data.createdAt).toBeInstanceOf(Date);
      // Check if putRow was called by the save method
      expect(mockPutRow).toHaveBeenCalledTimes(1);
    });

    it("should throw validation error if create data is invalid", async () => {
      const invalidUserData = {
        userId: "u-4",
        orgId: 400,
        name: "David",
        email: "invalid-email",
      };
      // create calls the constructor which validates
      await expect(UserModel.create(invalidUserData)).rejects.toThrow(
        v.ValiError
      );
      expect(mockPutRow).not.toHaveBeenCalled(); // Ensure putRow is not called on validation error
    });
  });

  describe("UserModel.findById()", () => {
    const pk = { userId: "find-me", orgId: Tablestore.Long.fromNumber(500) };
    const dbRowData = {
      primaryKey: [
        { name: "userId", value: "find-me" },
        { name: "orgId", value: Tablestore.Long.fromNumber(500) },
      ],
      attributes: [
        {
          columnName: "name",
          columnValue: "Found User",
          timestamp: Tablestore.Long.fromNumber(Date.now()),
        },
        {
          columnName: "email",
          columnValue: "found@example.com",
          timestamp: Tablestore.Long.fromNumber(Date.now()),
        },
        {
          columnName: "isActive",
          columnValue: false,
          timestamp: Tablestore.Long.fromNumber(Date.now()),
        },
        // Timestamps from DB might be Long or handled by SDK/converter
        {
          columnName: "createdAt",
          columnValue: Tablestore.Long.fromNumber(Date.now() - 10000),
          timestamp: Tablestore.Long.fromNumber(Date.now()),
        },
        {
          columnName: "updatedAt",
          columnValue: Tablestore.Long.fromNumber(Date.now() - 5000),
          timestamp: Tablestore.Long.fromNumber(Date.now()),
        },
      ],
    };

    it("should call client.getRow with correct parameters", async () => {
      mockGetRow.mockResolvedValue({ row: dbRowData }); // Mock successful response
      await UserModel.findById(pk);

      expect(mockGetRow).toHaveBeenCalledTimes(1);
      expect(mockGetRow).toHaveBeenCalledWith(
        expect.objectContaining({
          // Use objectContaining for flexibility
          tableName: "users_table",
          primaryKey: [{ userId: pk.userId }, { orgId: pk.orgId }],
          maxVersions: 1,
        })
      );
    });

    it("should return a Document instance if row is found", async () => {
      mockGetRow.mockResolvedValue({ row: dbRowData });
      const userDoc = await UserModel.findById(pk);

      expect(userDoc).toBeInstanceOf(Object);
      expect(userDoc).toHaveProperty("toObject"); // Check if it behaves like a Document
      const docData = userDoc?.toObject();
      expect(docData).toMatchObject({
        userId: "find-me",
        orgId: 500, // Converted from Long by tablestoreToJs
        name: "Found User",
        email: "found@example.com",
        isActive: false,
      });
      // Check if timestamps were parsed (tablestoreToJs converts Long to number, parse creates Date)
      expect((docData as any).createdAt).toBeInstanceOf(Date);
      expect((docData as any).updatedAt).toBeInstanceOf(Date);
    });

    it("should return null if row is not found", async () => {
      mockGetRow.mockResolvedValue({ row: null }); // Mock empty response
      const userDoc = await UserModel.findById(pk);
      expect(userDoc).toBeNull();
    });

    it("should throw error if primary keys provided are invalid", async () => {
      const invalidPk = { userId: "only-one" }; // Missing orgId
      await expect(UserModel.findById(invalidPk)).rejects.toThrow(
        `为模型 ${UserModel.modelName} 提供的 primaryKeys 无效。需要: userId, orgId`
      );
    });

    it("should handle errors from client.getRow", async () => {
      const error = new Error("Tablestore Error");
      mockGetRow.mockRejectedValue(error);
      await expect(UserModel.findById(pk)).rejects.toThrow("Tablestore Error");
    });

    // TODO: Add test case for when schema.parse fails for DB data (after type conversion)
  });

  // --- Document Instance Method Tests ---

  describe("Document instance methods", () => {
    let doc: Document<any>;
    const docData = { userId: "doc-1", orgId: 600, name: "Doc Instance" };
    let docCreatedAt: Date; // To store the exact date for comparison

    beforeEach(() => {
      doc = new UserModel(docData);
      // Store the exact creation date for save test comparison
      docCreatedAt = (doc as any)._data.createdAt;
      // Mock putRow for save tests
      mockPutRow.mockResolvedValue({}); // Mock successful putRow
    });

    it("toObject() should return plain data object", () => {
      const plainObject = doc.toObject();
      expect(plainObject).toEqual({
        userId: "doc-1",
        orgId: 600,
        name: "Doc Instance",
        isActive: true, // Default
        createdAt: expect.any(Date), // Timestamps are Date objects
        updatedAt: expect.any(Date),
      });
      // Ensure it's a copy
      expect(plainObject).not.toBe((doc as any)._data);
    });

    it("save() should call client.putRow with correct parameters", async () => {
      const doc = new UserModel({
        userId: "doc-1",
        orgId: 600,
        name: "Doc Instance",
      });
      mockPutRow.mockResolvedValue({}); // Mock successful putRow

      await doc.save();

      expect(mockPutRow).toHaveBeenCalledTimes(1);
      // Get the actual call arguments
      const callArgs = mockPutRow.mock.calls[0][0];

      // Verify structure and specific values
      expect(callArgs).toMatchObject({
        tableName: "users_table",
        primaryKey: expect.arrayContaining([
          { userId: "doc-1" },
          { orgId: Tablestore.Long.fromNumber(600) }, // Converter should handle this
        ]),
        attributeColumns: expect.arrayContaining([
          { name: "Doc Instance" },
          { isActive: true }, // Default value applied
          // Use expect.anything() here as expect.any(Tablestore.Long) might cause issues
          { createdAt: expect.anything() },
          { updatedAt: expect.anything() },
        ]),
        condition: expect.objectContaining({
          rowExistenceExpectation: Tablestore.RowExistenceExpectation.IGNORE,
          columnCondition: null,
        }),
        returnContent: {
          returnType: Tablestore.ReturnType.NONE,
        },
      });

      // Explicitly check that createdAt and updatedAt are Tablestore.Long instances
      const createdAtColumn = callArgs.attributeColumns.find(
        (col: any) => col.createdAt !== undefined
      );
      const updatedAtColumn = callArgs.attributeColumns.find(
        (col: any) => col.updatedAt !== undefined
      );
      // Check if the values look like Tablestore.Long instances by checking for .toNumber method
      expect(createdAtColumn?.createdAt?.toNumber).toBeDefined();
      expect(updatedAtColumn?.updatedAt?.toNumber).toBeDefined();
      // Optionally, a looser check for object type
      expect(typeof createdAtColumn?.createdAt).toBe("object");
      expect(typeof updatedAtColumn?.updatedAt).toBe("object");

      // Additional check for the Condition part more explicitly if needed
      // expect(callArgs.condition).toBeInstanceOf(Tablestore.Condition); // This might also fail
      expect(callArgs.condition?.rowExistenceExpectation).toBe(
        Tablestore.RowExistenceExpectation.IGNORE
      );
      expect(callArgs.condition?.columnCondition).toBeNull();

      // Check that primary keys are not duplicated in attribute columns
      const attributeKeys = callArgs.attributeColumns.map(
        (col: any) => Object.keys(col)[0]
      );
      expect(attributeKeys).not.toContain("userId");
      expect(attributeKeys).not.toContain("orgId");
    });

    it("save() should handle errors from client.putRow", async () => {
      const doc = new UserModel({
        userId: "doc-2",
        orgId: 700,
        name: "Error Case",
      });
      const error = new Error("PutRow Failed");
      mockPutRow.mockRejectedValue(error);
      await expect(doc.save()).rejects.toThrow("PutRow Failed");
      // Check the number of calls after the change to be sure
      expect(mockPutRow).toHaveBeenCalledTimes(1);
    });

    it("update() should throw not implemented error (for now)", async () => {
      await expect(doc.update({ name: "New Name" })).rejects.toThrow(
        "update() 方法尚未实现。"
      );
    });
    it("delete() should throw not implemented error (for now)", async () => {
      await expect(doc.delete()).rejects.toThrow("delete() 方法尚未实现。");
    });
  });
});
