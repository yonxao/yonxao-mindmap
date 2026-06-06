/*
 * 文件作用：
 * 这是插件源码层的入口文件，也是 esbuild 打包时的 entry point。
 *
 * 执行逻辑：
 * 1. scripts/build-js.mjs 从这里开始分析 import 依赖。
 * 2. 本文件只导入真正的插件类 YonxaoMindmapPlugin。
 * 3. 通过 export default 暴露给 esbuild，最终生成 dist/main.js。
 *
 * 调用链位置：
 * Obsidian 加载生成后的 main.js -> default export -> YonxaoMindmapPlugin.onload()
 */

import { YonxaoMindmapPlugin } from './plugin/YonxaoMindmapPlugin.js';

export default YonxaoMindmapPlugin;
