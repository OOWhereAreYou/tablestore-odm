// jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // 使用 roots 指向测试目录，Jest 会自动查找里面的测试文件
  roots: ["<rootDir>/test"], // 主要修改点：指定测试文件的根目录
  // 或者修改 testMatch
  // testMatch: ['<rootDir>/test/**/*.test.ts'], // 匹配 test 目录下所有 .test.ts 文件
  // (可选) 配置 moduleNameMapper 以便测试文件能正确导入 src 下的模块
  moduleNameMapper: {
    // 这个映射假设你的 import 路径是从 src 开始的，
    // 例如在 test 文件中 import { Connection } from '../src/connection';
    // 如果你想用别名，比如 import { Connection } from '@/connection';
    // 则需要配置路径别名 (在 tsconfig.json 的 paths 和这里的 moduleNameMapper)
    // 目前我们不需要别名，但保留这个示例：
    // '^@/(.*)$': '<rootDir>/src/$1',

    // 重要：确保测试文件能找到 src 下编译前的 TS 文件
    // 通常 ts-jest 会处理好这一点，但如果遇到问题，可能需要类似下面的映射
    // (根据你的实际导入方式调整)
    "^../src/(.*)$": "<rootDir>/src/$1", // 如果测试文件中使用相对路径导入 src
    // 或者如果直接从包名导入 (如果设置了 paths 或 link 了自己)
    // '^package-name/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  // (可选) 配置从哪里收集覆盖率信息，确保只包含 src 目录
  collectCoverageFrom: ["src/**/*.ts"],
};
