/*
 * 文件作用：
 * 这里保存通用数学工具。
 *
 * 当前功能：
 * clamp 把数值限制在 min 和 max 之间，常用于缩放范围、幕布高度和主题宽度。
 *
 * 调用链位置：
 * renderer/layout/markdown 等模块都会复用 clamp，避免重复实现。
 */

/*
 * 作用：
 * 将 value 限制在 min 到 max 之间。
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
