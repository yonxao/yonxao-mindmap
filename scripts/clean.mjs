/*
 * 文件作用：
 * 这个脚本负责清理构建产物目录 dist/。
 *
 * 执行逻辑：
 * clean 删除整个 dist/；release 在重新生成发布产物前调用它，
 * 避免上一次构建留下的文件混入正式发布目录。
 *
 * 调用链位置：
 * package.json scripts.clean -> scripts/clean.mjs -> 删除 dist/
 */

import fs from 'node:fs';
import path from 'node:path';

const distDir = path.join(process.cwd(), 'dist');

// force: true 让第一次运行 clean 时也不会因为 dist/ 不存在而失败。
fs.rmSync(distDir, { recursive: true, force: true });
console.log(`Cleaned build output directory: ${distDir}`);
