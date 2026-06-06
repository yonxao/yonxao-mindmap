/*
 * 文件作用：
 * 这个脚本负责清理发布目录 dist/。
 *
 * 执行逻辑：
 * release:prepare 会先调用 clean，删除上一次构建留下的 dist/，
 * 然后重新构建 JS、CSS 并复制 manifest.json，保证发布目录不会混入旧文件。
 *
 * 调用链位置：
 * package.json scripts.clean -> scripts/clean.mjs -> 删除 dist/
 */

import fs from 'node:fs';
import path from 'node:path';

const distDir = path.join(process.cwd(), 'dist');

// force: true 让第一次运行 clean 时也不会因为 dist/ 不存在而失败。
fs.rmSync(distDir, { recursive: true, force: true });
console.log(`Cleaned release directory: ${distDir}`);
