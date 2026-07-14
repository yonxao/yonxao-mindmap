/*
 * 文件作用：
 * 这个脚本服务本地 Obsidian 插件开发，把根目录的 .hotreload 标记文件
 * 复制到已经组装好的 dist/.hotreload。
 *
 * 为什么需要它：
 * 主流工程习惯把插件安装/发布产物放在 dist/。如果本地调试时把 dist/ 链接或复制到
 * .obsidian/plugins/yonxao-mindmap，Obsidian Hot Reload 插件需要在这个实际插件目录里看到
 * .hotreload 文件，才能在 dist/main.js 或 dist/styles.css 更新后自动重载插件。
 *
 * 执行逻辑：
 * 1. npm run dev 先执行 build、build:check 和 prepare-plugin-dir.mjs，准备基础插件文件。
 * 2. 本脚本读取项目根目录的 .hotreload。
 * 3. 将它复制到 dist/.hotreload。
 * 4. dist/ 变成适合本地 Obsidian 调试的插件目录：main.js、styles.css、manifest.json、.hotreload。
 *
 * 调用链位置：
 * package.json scripts.dev -> scripts/copy-hotreload.mjs -> dist/.hotreload
 */

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const sourceHotReloadFile = path.join(projectRoot, '.hotreload');
const targetHotReloadFile = path.join(distDir, '.hotreload');

if (!fs.existsSync(sourceHotReloadFile)) {
  // .hotreload 是本地调试输入文件；缺失时直接失败，避免生成一个不可热重载的调试目录。
  throw new Error('dev 找不到根目录 .hotreload，请先创建该文件。');
}

if (!fs.existsSync(distDir)) {
  // dev 理论上会先完成构建；这里作为防御性检查，给出明确的失败原因。
  throw new Error('dev 找不到 dist/，请先确认构建步骤已完成。');
}

// dist/ 被 Obsidian 当作插件目录时，Hot Reload 插件需要在 dist/ 内看到这个标记文件。
fs.copyFileSync(sourceHotReloadFile, targetHotReloadFile);

console.log('Prepared Obsidian development directory: dist/.hotreload copied.');
