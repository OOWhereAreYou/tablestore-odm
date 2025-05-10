// examples/basic-usage.ts

import { config } from "dotenv";
import { z } from "zod";

import { Connection, OdmConfig } from "../src/connection";
import { createModel } from "../src/model";
import {
  createSchema,
  DbSchema,
  FieldType,
  SchemaOptions,
} from "../src/schema";

config();

// --- 1. 定义schema ---
const ProductSchemaDefinition = {
  productId: z.string(), // PK
  category: z.string(), // PK
  name: z.string(),
  price: z.number().default(0),
  tags: z.array(z.string()).optional(),
  stock: z.number().int().optional(),
  description: z.string().optional(),
  status: z.boolean().default(() => true),
};

const zodProductSchema = z.object(ProductSchemaDefinition);

const ProductSchemaOptions: SchemaOptions<typeof zodProductSchema> = {
  primaryKeys: ["productId", "category"],
  GSIs: [
    {
      indexName: "category_index",
      primaryKeys: ["category"],
    },
  ],
  searchIndexes: [
    {
      indexName: "products_table_index",
      indexSetting: {
        schema: {
          fieldSchemas: [
            {
              fieldName: "name",
              fieldType: FieldType.KEYWORD,
              index: true,
            },
          ],
        },
      },
    },
  ],
};

// 为 ProductSchema 添加显式类型注解
const ProductSchema = createSchema(zodProductSchema, ProductSchemaOptions);

const realConfig: OdmConfig = {
  endpoint: process.env.TABLE_STORE_ENDPOINT || "",
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.ALIYUN_ACCESS_KEY_SECRET || "",
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || "",
  instancename: process.env.TABLE_STORE_INSTANCE_NAME || "",
  // Add other options like maxRetries if needed from env vars
  // maxRetries: process.env.TABLESTORE_MAX_RETRIES ? parseInt(process.env.TABLESTORE_MAX_RETRIES, 10) : undefined,
};

// --- 2. 新建连接 ---
const connection = new Connection(realConfig);

// --- 3. 新建Model--- d
const TABLE_NAME = "products_table";
const Product = createModel("Product", ProductSchema, TABLE_NAME, connection);

async function runExample() {
  const gsiPks = ProductSchema.getGsiPks("category_index");
  console.log(gsiPks);
}

// --- Run the Example ---
runExample().catch((err) => {
  console.error("\n--- A critical error occurred during example execution ---");
  console.error(err);
  process.exit(1);
});

// --- 4. 使用样例 ----

// 批量创建
async function batchCreateExample() {
  const startTime = Date.now();
  for (let i = 0; i < 1000; i++) {
    const product = {
      productId: `p-batch-00${i}`,
      category: "clothing",
      name: `Batch T-Shirt${i}`,
      price: 16.5 + i * 0.1,
      stock: 2024,
      status: true,
    };
    const productInstance = new Product(product);
    await productInstance.save();
  }
  console.log(`${Date.now() - startTime} ms`);
}

// 创建产品示例
async function createProductExample() {
  // 使用create方法创建
  const product1 = {
    name: "create",
    productId: "p-real-001",
    category: "dds",
    price: 0.5,
    status: true,
  };
  const createProduct = await Product.create(product1);
  console.log("4.1.1 create p-real-001.", createProduct);

  // 使用save方法创建
  const productData2 = {
    productId: "p-real-002",
    category: "unknown",
    name: "Real T-Shirt2333",
    price: 16.5,
    stock: 2024,
    status: false,
  };
  const prodect2 = new Product(productData2);
  console.log("4.1.2 save p-real-002.", await prodect2.save());
}

// 查询产品示例
async function findProductExample() {
  const findPk = { productId: "p-real-002", category: "unknown" };
  const findProduct = await Product.findById(findPk);
  console.log("4.2 find p-real-002.", findProduct);
  const result = await Product.findById({
    productId: "p-real-008",
    category: "unknown",
  });
  console.log(result);
}

// 更新产品示例
async function updateProductExample() {
  const findPk = { productId: "p-real-002", category: "unknown" };
  const [err, result] = await Product.updateById(findPk, {});
  console.log("4.3 update p-real-002.", result);
  console.log(await Product.findById(findPk));
}

// 删除产品示例
async function deleteProductExample() {
  const product3 = new Product({
    productId: "p-real-003",
    category: "clothing",
    name: "Real T-Shirt3",
    price: 16.5,
    stock: 2024,
    status: false,
  });

  console.log("save p-real-003.", await product3.save());

  console.log(
    await Product.findById({ productId: "p-real-003", category: "clothing" })
  );

  // 使用delete方法删除
  console.log("4.4.1 delete p-real-003.", await product3.delete());

  const product4 = new Product({
    productId: "p-real-004",
    category: "clothing",
    name: "Real T-Shirt4",
    price: 16.5,
    stock: 2024,
    status: true,
  });
  await product4.save();
  console.log("save p-real-004.", product4);

  // 使用deleteById方法删除
  console.log(
    "4.4.2 deleteById p-real-004.",
    await Product.deleteById({ productId: "p-real-004", category: "clothing" })
  );
}

async function rangeQuery() {
  const startTime = Date.now();
  const result = await Product.range()
    .startWith({})
    .endAt({})
    .filter((f) => f.and(f.greaterThan("price", 10), f.lessThan("price", 17)))
    .limit(10)
    .exec();
  console.log(JSON.stringify(result, null, 2));
  console.log(`${Date.now() - startTime} ms`);
}

async function searchQuery() {
  const startTime = Date.now();
  const result = await Product.search("products_table_index")
    .filter((f) => f.prefix("name", "Batch"))
    .limit(2)
    .exec();
  console.log(JSON.stringify(result, null, 2));

  console.log(`${Date.now() - startTime} ms`);
}
