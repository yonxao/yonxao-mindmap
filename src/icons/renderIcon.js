/*
 * 文件作用：
 * 这里负责把主题属性里的 icon 名称绘制成 SVG 图标。
 *
 * 执行逻辑：
 * 1. normalizeIcon 把用户输入规范化成小写名称。
 * 2. renderIcon 优先从 ICON_PATHS 找内置图标。
 * 3. 如果没有匹配的内置图标，就绘制一个两字母 fallback 圆形标记，避免界面空白。
 *
 * 调用链位置：
 * layoutTree.measureTopic() 读取图标影响主题宽度；YonxaoMindmapRenderer.renderTopic() 真正绘制图标。
 */

import { ICON_SIZE } from '../constants.js';
import { transparentColor } from '../utils/color.js';
import { clamp } from '../utils/math.js';
import { svg } from '../utils/svg.js';
import { ICON_PATHS } from './iconPaths.js';

/*
 * 作用：
 * 规范化用户在 [icon=...] 中输入的图标名。
 *
 * 调用链：
 * layoutTree.measureTopic() -> normalizeIcon()，用于决定主题是否预留图标宽度。
 */
export function normalizeIcon(icon) {
  const value = String(icon || '')
    .trim()
    .toLowerCase();
  return value || '';
}

/*
 * 作用：
 * 根据主题字体计算图标尺寸，让图标和主题文字视觉比例一致。
 */
export function resolveTopicIconSize(font = {}) {
  const fontSize = Number(font.size) || ICON_SIZE;
  const lineHeight = Number(font.lineHeight) || fontSize * 1.3;
  const maxSize = Math.max(ICON_SIZE, Math.min(48, lineHeight * 0.9));
  return Math.round(clamp(fontSize * 0.86, ICON_SIZE, maxSize));
}

/*
 * 作用：
 * 根据图标名创建 SVG 图标主题。
 *
 * 调用链：
 * YonxaoMindmapRenderer.renderTopic() -> renderIcon() -> ICON_PATHS/svg()。
 *
 * 实现逻辑：
 * 内置图标使用 path；未知图标用两字符徽标兜底，避免用户输入不被看见。
 */
export function renderIcon(iconName, x, y, color, size = ICON_SIZE) {
  const group = svg('g', {
    class: 'yonxao-mindmap-topic-icon',
    transform: `translate(${x} ${y})`,
  });

  const paths = ICON_PATHS[iconName];
  if (paths) {
    // 内置图标按 24x24 设计，再缩放到当前主题字体匹配的图标尺寸。
    const iconGroup = svg('g', {
      transform: `scale(${size / 24})`,
      stroke: color || 'currentColor',
    });
    for (const d of paths) {
      iconGroup.appendChild(svg('path', { d }));
    }
    group.appendChild(iconGroup);
    return group;
  }

  const fallback = svg('text', {
    x: size / 2,
    y: size / 2 + size * 0.25,
    'text-anchor': 'middle',
    'font-size': Math.max(8, Math.round(size * 0.48)),
  });
  fallback.textContent = iconName.slice(0, 2).toUpperCase();
  group.appendChild(
    svg('circle', {
      cx: size / 2,
      cy: size / 2,
      r: size / 2,
      fill: color ? transparentColor(color, 0.14) : 'var(--background-modifier-hover)',
    })
  );
  group.appendChild(fallback);
  return group;
}
