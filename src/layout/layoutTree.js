/*
 * 文件作用：
 * 布局系统对外入口，负责选择布局策略并返回可绘制结果。
 */

import { normalizeMindConfig } from '../config/mindConfig.js';
import { collectVisible, computeBounds } from './layoutBounds.js';
import { layoutFishbone } from './fishboneLayout.js';
import { layoutHorizontalMind, layoutVerticalMind } from './mindmapLayout.js';
import { layoutOrgChart } from './orgLayout.js';
import { layoutRadial } from './radialLayout.js';
import { prepareTopic } from './layoutShared.js';
import { layoutTimeline } from './timelineLayout.js';
import { layoutTreeTable } from './treeTableLayout.js';
import { layoutOutlineTree } from './treeLayout.js';
import { resolveEffectiveBranchExpansion, resolveLayoutType } from './layoutTypes.js';

export { collectVisible, computeBounds } from './layoutBounds.js';

/*
 * 作用：
 * 计算整棵思维导图的可见主题、连线和整体边界。
 *
 * 设计思路：
 * 不同布局共享“测量主题”和“收集主题”的流程，只把坐标分配拆成多个策略。
 * 这样新增布局不会破坏已经稳定的水平 mind map 布局。
 */
export function layoutTree(root, collapsedIds, config, options = {}) {
  const normalizedConfig = normalizeMindConfig(config);
  prepareTopic(root, normalizedConfig, options);

  const rootBox = root._layout;
  rootBox.x = 0;
  rootBox.y = 0;
  rootBox.side = 'root';

  const layoutType = resolveLayoutType(normalizedConfig);
  const branchExpansion = resolveEffectiveBranchExpansion(layoutType, normalizedConfig);
  if (
    layoutType === 'mindmap-down' ||
    layoutType === 'mindmap-up' ||
    layoutType === 'mindmap-vertical'
  ) {
    layoutVerticalMind(root, collapsedIds, layoutType, branchExpansion);
  } else if (layoutType === 'tree-right' || layoutType === 'tree-left' || layoutType === 'tree') {
    layoutOutlineTree(root, collapsedIds, layoutType, branchExpansion);
  } else if (layoutType === 'org' || layoutType === 'org-right') {
    layoutOrgChart(root, collapsedIds, layoutType, branchExpansion);
  } else if (
    layoutType === 'timeline-up' ||
    layoutType === 'timeline-down' ||
    layoutType === 'timeline'
  ) {
    layoutTimeline(root, collapsedIds, layoutType, branchExpansion);
  } else if (layoutType === 'radial') {
    layoutRadial(root, collapsedIds);
  } else if (layoutType === 'fishbone-left' || layoutType === 'fishbone-right') {
    layoutFishbone(root, collapsedIds, layoutType, branchExpansion);
  } else if (layoutType === 'tree-table') {
    layoutTreeTable(root, collapsedIds, { fillLeafRemainderColumns: true });
  } else if (layoutType === 'tree-table-stepped') {
    layoutTreeTable(root, collapsedIds, { fillLeafRemainderColumns: false });
  } else {
    layoutHorizontalMind(root, collapsedIds, layoutType, branchExpansion);
  }

  const topics = [];
  const connectors = [];
  collectVisible(root, collapsedIds, topics, connectors);

  return {
    topics,
    connectors,
    bounds: computeBounds(topics),
    mode: layoutType,
  };
}
