/*
 * 文件作用：
 * 布局系统对外入口，负责选择布局策略并返回可绘制结果。
 */

import { layoutTree as layoutMeasuredTree } from '@yonxao/mindmap-core';
import { normalizeMindConfig } from '../config/mindConfig.js';
import { prepareTopic } from './layoutShared.js';
import { resolveEffectiveBranchExpansion, resolveLayoutType } from './layoutTypes.js';

export { collectVisible, computeBounds } from '@yonxao/mindmap-core';

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

  const layoutType = resolveLayoutType(normalizedConfig);
  const branchExpansion = resolveEffectiveBranchExpansion(layoutType, normalizedConfig);
  return layoutMeasuredTree(root, collapsedIds, {
    mode: layoutType,
    branchExpansion,
  });
}
