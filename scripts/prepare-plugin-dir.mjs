/*
 * 文件作用：
 * 这个脚本负责把 manifest.json 复制到 dist/，并检查 Obsidian 插件基础文件是否齐全。
 *
 * 执行逻辑：
 * 1. dev 或 release 先执行 build 和 build:check，生成并检查 dist/main.js 与 dist/styles.css。
 * 2. 本脚本把 manifest.json 复制到 dist/manifest.json。
 * 3. 最后检查插件三件套是否齐全；开发准备和发布准备都复用这一步。
 *
 * 调用链位置：
 * package.json dev/release -> scripts/prepare-plugin-dir.mjs -> dist/
 */

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const requiredFiles = ['main.js', 'styles.css', 'manifest.json'];

fs.mkdirSync(distDir, { recursive: true });
// manifest.json 不经过构建，直接复制到 dist/，让发布目录满足 Obsidian 插件三件套要求。
fs.copyFileSync(path.join(projectRoot, 'manifest.json'), path.join(distDir, 'manifest.json'));

// 检查最终发布目录，而不是只相信上游脚本成功；这样 CI 或本地构建失败时能更早暴露。
const missingFiles = requiredFiles.filter(
  (fileName) => !fs.existsSync(path.join(distDir, fileName))
);

if (missingFiles.length) {
  throw new Error(`插件目录缺少基础文件：${missingFiles.join(', ')}`);
}

console.log(`Prepared Obsidian plugin directory: ${distDir}`);
