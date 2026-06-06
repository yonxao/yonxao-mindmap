/*
 * 文件作用：
 * 这里集中处理颜色相关的小工具，避免把颜色校验和透明色计算散落在渲染器里。
 *
 * 执行逻辑：
 * - normalizeColor 只接受 hex 或常见 CSS 颜色名，降低把异常字符串写进 SVG 属性的风险。
 * - transparentColor 把 hex 颜色转换为 rgba，用于节点的浅色背景。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer.renderNode()/renderEdge() -> nodeColor()/transparentColor()
 */

/*
 * 作用：
 * 从节点 attrs 中读取并规范化节点颜色。
 */
export function nodeColor(node) {
  return normalizeColor(node.attrs.color);
}

/*
 * 作用：
 * 校验并规范化用户输入的颜色值。
 *
 * 实现逻辑：
 * 支持 #rgb/#rrggbb、无 # 的 hex，以及简单 CSS 颜色名。
 */
export function normalizeColor(color) {
  const value = String(color || '').trim();
  if (!value) return '';
  // 只接受常见 CSS 颜色名和 hex，避免把任意字符串塞到 SVG 属性里。
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) return value;
  if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) return `#${value}`;
  if (/^[a-z][a-z0-9-]*$/i.test(value)) return value;
  return '';
}

/*
 * 作用：
 * 把 hex 颜色转换成带透明度的 rgba 背景色。
 */
export function transparentColor(color, alpha) {
  const hex = normalizeColor(color);
  const match = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return 'var(--background-primary)';

  // 主题色用作描边，同时生成一个低透明度背景，让节点有轻微色块感。
  let value = match[1];
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
