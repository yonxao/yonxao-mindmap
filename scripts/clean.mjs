/*
 * 文件作用：
 * 这个脚本负责清理插件和公共核心的构建产物目录。
 *
 * 执行逻辑：
 * clean 删除根 dist/ 和两个公共包的 dist/；release 在重新生成发布产物前调用它，
 * 避免上一次构建留下的插件或公共包文件混入正式发布目录。
 *
 * 调用链位置：
 * package.json scripts.clean -> scripts/clean.mjs -> 删除各构建目录
 */

import fs from 'node:fs';
import path from 'node:path';

const buildOutputDirs = [
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'packages/core/dist'),
  path.join(process.cwd(), 'packages/svg-renderer/dist'),
];

// force: true 让第一次运行 clean 时也不会因为目录不存在而失败。
for (const outputDir of buildOutputDirs) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  console.log(`Cleaned build output directory: ${outputDir}`);
}
