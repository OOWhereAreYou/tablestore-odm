
# Tablestore ODM

**Tablestore ODM** 是一个基于 [阿里云表格存储 (Tablestore)](https://www.aliyun.com/product/ots) 的对象文档映射 (ODM) 库，旨在简化与 Tablestore 的交互，提供更直观、类型安全的数据操作体验。

## 特性

- **Schema 定义：** 使用 Zod 进行数据模型定义和验证，确保数据类型安全。
- **模型抽象：** 将 Tablestore 表映射为 JavaScript 类，提供 CRUD 方法。
- **查询构建器：** 提供链式调用的查询构建器，支持范围查询和多元索引查询。
  - **范围查询 (Range Query):**  使用 `startWith` 和 `endAt` 指定范围，支持正向和反向查询，可设置 `limit` 限制返回数量，使用 `filter` 进行服务端过滤。
  - **多元索引查询 (Search Query):**  支持全文检索、精确匹配、前缀匹配、范围查询、通配符查询、地理位置查询等多种查询类型，并支持排序、分页和结果折叠。
- **类型安全：** 充分利用 TypeScript 的类型推断，减少运行时错误。
- **连接管理：** 统一管理 Tablestore 客户端连接。
- **灵活配置：** 支持自定义配置，并允许透传 Tablestore SDK 的其他选项。
- **批量操作：** 支持 `insertMany` 和 `deleteMany` 进行批量插入和删除操作。
- **GSI 支持：** 支持全局二级索引 (GSI) 的查询。
- **字段类型转换：**  自动处理 JavaScript 类型与 Tablestore 类型的转换，例如 `number` 到 `Long`，`Date` 到时间戳等。

## 安装

```bash
npm install tablestore-odm

```

## 使用

### 快速开始

1. 定义 Schema：

```typescript
import { z } from "zod";
import { createSchema } from "tablestore-odm";

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().int().positive(),
  email: z.string().email().optional(),
});

const userSchema = createSchema(UserSchema, {
  primaryKeys: ["id"],
  timestamps: true, // 自动管理 createdAt 和 updatedAt 字段
});
```

2. 创建 Model：

```typescript
import { Connection, createModel } from "tablestore-odm";

const connection = new Connection({
  endpoint: "your_endpoint",
  accessKeyId: "your_access_key_id",
  secretAccessKey: "your_secret_access_key",
  instancename: "your_instance_name",
});

const UserModel = createModel(
  "User",
  userSchema,
  "your_user_table_name",
  connection
);

```

```typescript

async function main() {
  // 创建用户
  const [createErr, createdUser] = await UserModel.create({
    id: "user123",
    name: "Alice",
    age: 30,
    email: "<alice@example.com>",
  });

  if (createErr) {
    console.error("创建用户失败:", createErr);
    return;
  }

  console.log("创建用户成功:", createdUser);

  // 查询用户
  const [findErr, foundUser] = await UserModel.findById({ id: "user123" });

  if (findErr) {
    console.error("查询用户失败:", findErr);
    return;
  }

  if (foundUser) {
    console.log("查询用户成功:", foundUser);

    // 更新用户
    const [updateErr] = await UserModel.updateById(
      { id: "user123" },
      { age: 31 }
    );

    if (updateErr) {
      console.error("更新用户失败:", updateErr);
      return;
    }

    console.log("更新用户成功");

    // 删除用户
    const [deleteErr] = await UserModel.deleteById({ id: "user123" });

    if (deleteErr) {
      console.error("删除用户失败:", deleteErr);
      return;
    }

    console.log("删除用户成功");
  } else {
    console.log("未找到用户");
  }
}

main();

```

- 范围查询

``` typescript
// 查询年龄在 20 到 30 岁之间的用户
const [err, result] = await UserModel.range()
  .startWith({ age: 20 })
  .endAt({ age: 30 })
  .filter((q) => q.greaterThanOrEqual("age", 20).lessThanOrEqual("age", 30)) // 使用 filter 进行服务端过滤
  .exec();

if (err) {
  console.error("范围查询失败:", err);
} else {
  console.log("范围查询结果:", result?.rows);
}
```

- 多元索引查询

``` typescript
// 假设有一个名为 "user_search_index" 的多元索引
const [err, result] = await UserModel.search("user_search_index")
  .filter((q) => q.match("name", "Alice")) // 匹配名字包含 "Alice" 的用户
  .limit(10)
  .exec();

if (err) {
  console.error("多元索引查询失败:", err);
} else {
  console.log("多元索引查询结果:", result?.rows);
  console.log("总匹配数:", result?.totalCount);
}

// 精确匹配
UserModel.search("user_search_index").filter(q => q.term("city", "Beijing")).exec();


```

### 批量操作

``` typescript
// 批量插入
const [insertErr, insertedKeys] = await UserModel.insertMany([
  { id: "user4", name: "David", age: 25 },
  { id: "user5", name: "Eve", age: 28 },
]);

if (insertErr) {
  console.error("批量插入失败:", insertErr);
} else {
  console.log("批量插入成功，插入的主键:", insertedKeys);
}

// 批量删除
const [deleteErr, deletedKeys] = await UserModel.deleteMany([
  { id: "user4" },
  { id: "user5" },
]);

if (deleteErr) {
  console.error("批量删除失败:", deleteErr);
} else {
  console.log("批量删除成功，删除的主键:", deletedKeys);
}

```

# 许可证

MIT 许可证
 