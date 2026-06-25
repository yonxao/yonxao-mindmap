/*
 * 文件作用：
 * 布局类型集合、布局组判断和下挂/连线能力判断。
 *
 * LAYOUT_TYPES 从 defaultMindConfig.js 导入，避免和配置系统的布局列表不一致。
 */

import { LAYOUT_TYPES } from '../config/defaultMindConfig.js';

export { LAYOUT_TYPES };

export function isBranchExpansionSupportedLayout(layoutType) {
  return (
    layoutType !== 'radial' && layoutType !== 'tree-table' && layoutType !== 'tree-table-stepped'
  );
}

/*
 * 作用：
 * 计算布局实际使用的连线线型。
 *
 * 规则：
 * 只有思维导图组读取 connector.style；其他结构图固定折线。
 */
export function effectiveConnectorStyleForLayout(layoutType, config) {
  return isMindMapLayoutType(layoutType) ? config.connector.style : 'elbow';
}

/*
 * 作用：
 * 根据布局和实际线型决定普通主题展开方式是否生效。
 */
export function resolveEffectiveBranchExpansion(layoutType, config) {
  if (!isBranchExpansionSupportedLayout(layoutType)) return 'side';
  if (effectiveConnectorStyleForLayout(layoutType, config) !== 'elbow') return 'side';
  return config.branch.expansion === 'hanging' ? 'hanging' : 'side';
}

/*
 * 作用：
 * 判断布局是否属于“思维导图”分组。
 */
export function isMindMapLayoutType(layoutType) {
  return (
    layoutType === 'mindmap-right' ||
    layoutType === 'mindmap-left' ||
    layoutType === 'mindmap-bidirectional' ||
    layoutType === 'mindmap-down' ||
    layoutType === 'mindmap-up' ||
    layoutType === 'mindmap-vertical'
  );
}

/*
 * 作用：
 * 决定当前整张图使用哪一种布局。
 *
 * 优先级：
 * 配置区 layout > mindmap-right。
 */
export function resolveLayoutType(config) {
  return normalizeLayoutType(config?.layout) || 'mindmap-right';
}

/*
 * 作用：
 * 规范化布局类型。
 */
export function normalizeLayoutType(layout) {
  const value = String(layout || '')
    .trim()
    .toLowerCase();
  return LAYOUT_TYPES.includes(value) ? value : '';
}
