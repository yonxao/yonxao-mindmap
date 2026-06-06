/*
 * 文件作用：
 * 这里负责把节点属性里的 icon 名称绘制成 SVG 图标。
 *
 * 执行逻辑：
 * 1. normalizeIcon 把用户输入规范化成小写名称。
 * 2. renderIcon 优先从 ICON_PATHS 找内置图标。
 * 3. 如果没有匹配的内置图标，就绘制一个两字母 fallback 圆形标记，避免界面空白。
 *
 * 调用链位置：
 * layoutTree.measureNode() 读取图标影响节点宽度；YonxaoMindmapRenderer.renderNode() 真正绘制图标。
 */

import { ICON_SIZE } from '../constants.js';
import { transparentColor } from '../utils/color.js';
import { svg } from '../utils/svg.js';
import { ICON_PATHS } from './iconPaths.js';

/*
 * 作用：
 * 规范化用户在 [icon=...] 中输入的图标名。
 *
 * 调用链：
 * layoutTree.measureNode() -> normalizeIcon()，用于决定节点是否预留图标宽度。
 */
export function normalizeIcon(icon) {
  const value = String(icon || '')
    .trim()
    .toLowerCase();
  return value || '';
}

/*
 * 作用：
 * 根据图标名创建 SVG 图标节点。
 *
 * 调用链：
 * YonxaoMindmapRenderer.renderNode() -> renderIcon() -> ICON_PATHS/svg()。
 *
 * 实现逻辑：
 * 内置图标使用 path；未知图标用两字符徽标兜底，避免用户输入不被看见。
 */
export function renderIcon(iconName, x, y, color) {
  const group = svg('g', {
    class: 'yonxao-mindmap-node-icon',
    transform: `translate(${x} ${y})`,
  });

  const paths = ICON_PATHS[iconName];
  if (paths) {
    // 内置图标按 24x24 设计，再缩放到节点中的 ICON_SIZE。
    const iconGroup = svg('g', {
      transform: `scale(${ICON_SIZE / 24})`,
      stroke: color || 'currentColor',
    });
    for (const d of paths) {
      iconGroup.appendChild(svg('path', { d }));
    }
    group.appendChild(iconGroup);
    return group;
  }

  const fallback = svg('text', {
    x: ICON_SIZE / 2,
    y: ICON_SIZE / 2 + 4,
    'text-anchor': 'middle',
  });
  fallback.textContent = iconName.slice(0, 2).toUpperCase();
  group.appendChild(
    svg('circle', {
      cx: ICON_SIZE / 2,
      cy: ICON_SIZE / 2,
      r: ICON_SIZE / 2,
      fill: color ? transparentColor(color, 0.14) : 'var(--background-modifier-hover)',
    })
  );
  group.appendChild(fallback);
  return group;
}
