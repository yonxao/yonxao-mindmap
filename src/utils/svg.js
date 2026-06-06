/*
 * 文件作用：
 * 这里提供一个创建 SVG 元素的小工具函数。
 *
 * 为什么需要它：
 * 原生 document.createElementNS 每次都要传 SVG 命名空间，并且逐个 setAttribute 比较啰嗦。
 * svg(tagName, attrs) 把这些重复动作封装起来，让 renderer 里的绘制代码更接近“声明图形结构”。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer/renderIcon -> svg() -> SVG DOM
 */

import { SVG_NS } from '../constants.js';

/*
 * 作用：
 * 创建 SVG 元素并批量写入属性。
 *
 * 调用链：
 * Renderer.renderNode()/renderEdge()/renderIcon() -> svg()。
 */
export function svg(tagName, attrs) {
  // 小工具函数：统一创建 SVG 元素并批量设置属性，减少绘制代码的噪音。
  const element = document.createElementNS(SVG_NS, tagName);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null) continue;
    element.setAttribute(key, String(value));
  }
  return element;
}
