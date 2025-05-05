import Tablestore from 'tablestore'; // 导入原始类型用于类型检查
import * as v from 'valibot';

// test/connection.test.ts
import {
  Connection,
  OdmConfig,
} from '../src/connection';
// Import createSchema and valibot for creating a mock schema
import {
  createSchema,
  Schema,
} from '../src/schema';

// 模拟 tablestore 模块
jest.mock("tablestore", () => {
  // 模拟 Client 类
  const MockClient = jest.fn().mockImplementation((config) => {
    // 可以根据需要模拟 Client 的行为
    console.log("Mock Tablestore.Client created with config:", config);
    return {
      // 模拟一些 Client 的方法或属性，如果测试需要的话
      config: config,
      // 示例：模拟一个简单的方法
      listTable: jest.fn().mockResolvedValue({ tables: [] }),
    };
  });
  return {
    // 导出模拟的 Client
    Client: MockClient,
    // 如果需要模拟 Tablestore 的其他导出（如常量），也在这里添加
    // 例如： Long: class Long {},
  };
});

describe("Connection Class", () => {
  const validConfig: OdmConfig = {
    endpoint: "http://mock-endpoint.com",
    accessKeyId: "mockAccessKeyId",
    secretAccessKey: "mockSecretAccessKey",
    instancename: "mockInstance",
  };

  const invalidConfigPartial = {
    endpoint: "http://mock-endpoint.com",
    accessKeyId: "mockAccessKeyId",
  };

  // 清除所有模拟，确保测试隔离
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw an error if required config is missing", () => {
    expect(() => new Connection(invalidConfigPartial as OdmConfig)).toThrow(
      "缺少必要的 Tablestore 配置信息 (endpoint, accessKeyId, secretAccessKey, instancename)"
    );
  });

  it("should create a Connection instance with valid config", () => {
    const connection = new Connection(validConfig);
    expect(connection).toBeInstanceOf(Connection);
    // 检查配置是否被正确存储（作为副本）
    // 注意：直接访问私有属性 config 在 TS 中不可行，但可以通过行为验证
    // 例如，验证 getClient 是否使用了正确的配置
    connection.getClient(); // 触发 client 初始化
    // @ts-ignore - 访问模拟的 Client 构造函数
    expect(Tablestore.Client).toHaveBeenCalledWith(validConfig);
  });

  it("should initialize and return a Tablestore Client via getClient()", () => {
    const connection = new Connection(validConfig);
    const client = connection.getClient();

    // 验证返回的是模拟的 Client 实例
    expect(client).toBeDefined();
    // @ts-ignore - 访问模拟的 Client 构造函数
    expect(Tablestore.Client).toHaveBeenCalledTimes(1);
    // @ts-ignore
    expect(Tablestore.Client).toHaveBeenCalledWith(validConfig);

    // 验证懒加载：再次调用 getClient 不应再次创建 Client
    const client2 = connection.getClient();
    expect(client2).toBe(client); // 应该是同一个实例
    // @ts-ignore - 访问模拟的 Client 构造函数
    expect(Tablestore.Client).toHaveBeenCalledTimes(1); // 调用次数仍为 1
  });

  it("should register and return a model via model()", () => {
    const connection = new Connection(validConfig);
    // Create a valid Schema instance for testing
    const testSchemaDefinition = {
      id: v.pipe(v.string(), v.uuid()),
      name: v.string(),
    };
    const ValibotSchema = v.object(testSchemaDefinition);
    const testSchemaOptions = { primaryKeys: ["id"] };
    const schemaInstance: Schema<v.ObjectSchema<any, any>> = createSchema(
      ValibotSchema,
      testSchemaOptions
    );

    const tableName = "users";
    const modelName = "User";

    const UserModel = connection.model(modelName, schemaInstance, tableName);

    expect(UserModel).toBeDefined();
    expect(UserModel.modelName).toBe(modelName);
    expect(UserModel.tableName).toBe(tableName);
    expect(UserModel.connection).toBe(connection); // 验证 connection 引用

    // 验证 get client 静态方法能返回正确的 client
    const clientFromModel = UserModel.client;
    expect(clientFromModel).toBeDefined();
    // @ts-ignore
    expect(Tablestore.Client).toHaveBeenCalledTimes(1); // Client 应该已被初始化

    // 验证重复注册返回同一个模型
    // Note: Passing schema again might trigger the re-registration warning
    const UserModelAgain = connection.model(modelName, schemaInstance, tableName);
    expect(UserModelAgain).toBe(UserModel);
  });

  it("should pass custom config options to the Tablestore Client", () => {
    const customConfig: OdmConfig = {
      ...validConfig,
      maxRetries: 5,
      requestTimeout: 10000,
      customOption: "testValue",
    };
    const connection = new Connection(customConfig);
    connection.getClient(); // 触发 client 初始化

    // @ts-ignore
    expect(Tablestore.Client).toHaveBeenCalledWith(customConfig);
  });
});
