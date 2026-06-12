/*
 * 文件作用：
 * 这里负责把树形数据计算成可绘制的节点坐标和连线关系。
 *
 * 执行逻辑：
 * 1. prepareNode 先测量每个节点的宽高和换行文本。
 * 2. layoutTree 根据 layout.defaultDirection 选择布局策略。
 * 3. 各布局策略只负责写入 node._layout.x/y/side。
 * 4. collectVisible 收集未折叠节点和连线，computeBounds 计算整体边界。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer.renderGraph() -> layoutTree() -> renderNode()/renderEdge()
 */

import {
  LEVEL_GAP,
  SIBLING_GAP,
  BRANCH_GAP,
  NODE_PADDING_X,
  NODE_PADDING_Y,
  NODE_MIN_WIDTH,
  NODE_MAX_WIDTH,
  NODE_MIN_HEIGHT,
  ICON_SIZE,
  ICON_GAP,
} from '../constants.js';
import { normalizeMindConfig, resolveNodeFont } from '../config/mindConfig.js';
import { normalizeIcon } from '../icons/renderIcon.js';
import { clamp } from '../utils/math.js';
import { visualUnits, wrapLabel } from '../utils/text.js';

export const LAYOUT_MODES = Object.freeze([
  'right',
  'left',
  'balanced',
  'down',
  'up',
  'vertical',
  'tree',
  'tree-left',
  'tree-balanced',
  'org',
  'org-right',
  'timeline-up',
  'timeline',
  'timeline-balanced',
  'radial',
]);

/*
 * 作用：
 * 计算整棵思维导图的可见节点、连线和整体边界。
 *
 * 设计思路：
 * 不同布局共享“测量节点”和“收集节点”的流程，只把坐标分配拆成多个策略。
 * 这样新增布局不会破坏已经稳定的水平 mind map 布局。
 */
export function layoutTree(root, collapsedIds, config) {
  const normalizedConfig = normalizeMindConfig(config);
  prepareNode(root, normalizedConfig);

  const rootBox = root._layout;
  rootBox.x = 0;
  rootBox.y = 0;
  rootBox.side = 'root';

  const mode = resolveLayoutMode(root, normalizedConfig);
  if (mode === 'down' || mode === 'up' || mode === 'vertical') {
    layoutVerticalMind(root, collapsedIds, mode);
  } else if (mode === 'tree' || mode === 'tree-left' || mode === 'tree-balanced') {
    layoutOutlineTree(root, collapsedIds, mode);
  } else if (mode === 'org' || mode === 'org-right') {
    layoutOrgChart(root, collapsedIds, mode);
  } else if (mode === 'timeline-up' || mode === 'timeline' || mode === 'timeline-balanced') {
    layoutTimeline(root, collapsedIds, mode);
  } else if (mode === 'radial') {
    layoutRadial(root, collapsedIds);
  } else {
    layoutHorizontalMind(root, collapsedIds, mode);
  }

  const nodes = [];
  const edges = [];
  collectVisible(root, collapsedIds, nodes, edges);

  return {
    nodes,
    edges,
    bounds: computeBounds(nodes),
    mode,
  };
}

/*
 * 作用：
 * 为每个节点预先写入 _layout 测量结果。
 */
export function prepareNode(node, config) {
  node._layout = measureNode(node, config);
  for (const child of node.children) {
    prepareNode(child, config);
  }
}

/*
 * 作用：
 * 根据节点文本、图标和常量配置估算节点宽高。
 */
export function measureNode(node, config) {
  const normalizedConfig = normalizeMindConfig(config);
  const font = resolveNodeFont(node, normalizedConfig);
  const icon = normalizeIcon(node.attrs.icon);
  const maxWidth = normalizedConfig.node.maxWidth || NODE_MAX_WIDTH;
  const iconWidth = icon ? ICON_SIZE + ICON_GAP : 0;
  const usableTextWidth = Math.max(48, maxWidth - NODE_PADDING_X * 2 - iconWidth);
  const averageUnitWidth = Math.max(5, font.size * 0.54);
  const maxUnits = clamp(Math.floor(usableTextWidth / averageUnitWidth), icon ? 10 : 12, 48);
  const lines = wrapLabel(node.text || 'Untitled', maxUnits);
  const longest = lines.reduce((max, line) => Math.max(max, visualUnits(line)), 0);
  const textWidth = Math.ceil(longest * averageUnitWidth);
  const width = clamp(textWidth + NODE_PADDING_X * 2 + iconWidth, NODE_MIN_WIDTH, maxWidth);
  const height = Math.max(NODE_MIN_HEIGHT, lines.length * font.lineHeight + NODE_PADDING_Y * 2);

  return {
    width,
    height,
    lines,
    icon,
    font,
    textX: NODE_PADDING_X + iconWidth,
    textY: (height - (lines.length - 1) * font.lineHeight) / 2 + font.size * 0.36,
    side: 'right',
    x: 0,
    y: 0,
  };
}

/*
 * 作用：
 * 决定当前整张图使用哪一种布局。
 *
 * 优先级：
 * 根节点属性 layout > 配置区 layout.defaultDirection > balanced。
 */
export function resolveLayoutMode(root, config) {
  return (
    normalizeLayout(root?.attrs?.layout) ||
    normalizeLayout(config?.layout?.defaultDirection) ||
    'balanced'
  );
}

/*
 * 作用：
 * 规范化布局名。
 */
export function normalizeLayout(layout) {
  const value = String(layout || '')
    .trim()
    .toLowerCase();
  return LAYOUT_MODES.includes(value) ? value : '';
}

/*
 * 作用：
 * 水平思维导图布局，覆盖 right/left/balanced。
 *
 * 说明：
 * 这是旧版布局的策略化版本，保留原有左右展开和左右平衡体验。
 */
export function layoutHorizontalMind(root, collapsedIds, mode) {
  const visibleRootChildren = visibleChildren(root, collapsedIds);
  const rightChildren = [];
  const leftChildren = [];

  visibleRootChildren.forEach((child, index) => {
    const side = rootChildHorizontalSide(root, child, index, mode);
    if (side === 'left') {
      leftChildren.push(child);
    } else {
      rightChildren.push(child);
    }
  });

  placeHorizontalRootSide(root, rightChildren, 'right', collapsedIds);
  placeHorizontalRootSide(root, leftChildren, 'left', collapsedIds);
}

/*
 * 作用：
 * 判断一级节点应该在左侧还是右侧。
 */
export function rootChildHorizontalSide(root, child, index, mode) {
  const childLayout = normalizeLayout(child.attrs.layout);
  if (childLayout === 'left' || childLayout === 'right') return childLayout;

  const rootLayout = normalizeLayout(root.attrs.layout);
  if (rootLayout === 'left' || rootLayout === 'right') return rootLayout;

  if (mode === 'left' || mode === 'right') return mode;
  return index % 2 === 0 ? 'right' : 'left';
}

/*
 * 作用：
 * 摆放根节点某一侧的一级子树。
 */
export function placeHorizontalRootSide(root, children, side, collapsedIds) {
  if (!children.length) return;

  const rootBox = root._layout;
  const heights = children.map((child) => horizontalSubtreeHeight(child, side, collapsedIds));
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, children.length - 1) * BRANCH_GAP;

  let y = rootBox.y - totalHeight / 2;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const height = heights[index];
    const childBox = child._layout;
    const dir = side === 'left' ? -1 : 1;

    childBox.side = side;
    childBox.x = rootBox.x + dir * (rootBox.width / 2 + LEVEL_GAP + childBox.width / 2);
    childBox.y = y + height / 2;

    placeHorizontalDescendants(child, side, collapsedIds);
    y += height + BRANCH_GAP;
  }
}

/*
 * 作用：
 * 递归摆放水平布局中的非根后代。
 */
export function placeHorizontalDescendants(parent, side, collapsedIds) {
  const children = visibleChildren(parent, collapsedIds);
  if (!children.length) return;

  const parentBox = parent._layout;
  const heights = children.map((child) => horizontalSubtreeHeight(child, side, collapsedIds));
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;

  let y = parentBox.y - totalHeight / 2;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const height = heights[index];
    const childBox = child._layout;
    const dir = side === 'left' ? -1 : 1;

    childBox.side = side;
    childBox.x = parentBox.x + dir * (parentBox.width / 2 + LEVEL_GAP + childBox.width / 2);
    childBox.y = y + height / 2;

    placeHorizontalDescendants(child, side, collapsedIds);
    y += height + SIBLING_GAP;
  }
}

/*
 * 作用：
 * 计算水平布局中一个子树需要的垂直高度。
 */
export function horizontalSubtreeHeight(node, side, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  if (!children.length) return box.height;

  const childHeight =
    children.reduce((sum, child) => sum + horizontalSubtreeHeight(child, side, collapsedIds), 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;

  return Math.max(box.height, childHeight);
}

/*
 * 作用：
 * 竖向思维导图布局，覆盖 down/up/vertical。
 */
export function layoutVerticalMind(root, collapsedIds, mode) {
  const visibleRootChildren = visibleChildren(root, collapsedIds);
  const bottomChildren = [];
  const topChildren = [];

  visibleRootChildren.forEach((child, index) => {
    const side = rootChildVerticalSide(child, index, mode);
    if (side === 'top') {
      topChildren.push(child);
    } else {
      bottomChildren.push(child);
    }
  });

  placeVerticalRootSide(root, bottomChildren, 'bottom', collapsedIds);
  placeVerticalRootSide(root, topChildren, 'top', collapsedIds);
}

/*
 * 作用：
 * 判断一级节点应该在上方还是下方。
 */
export function rootChildVerticalSide(child, index, mode) {
  const childLayout = normalizeLayout(child.attrs.layout);
  if (childLayout === 'up') return 'top';
  if (childLayout === 'down') return 'bottom';

  if (mode === 'up') return 'top';
  if (mode === 'down') return 'bottom';
  return index % 2 === 0 ? 'bottom' : 'top';
}

/*
 * 作用：
 * 摆放竖向布局中根节点某一侧的一级子树。
 */
export function placeVerticalRootSide(root, children, side, collapsedIds) {
  if (!children.length) return;

  const rootBox = root._layout;
  const widths = children.map((child) => verticalSubtreeWidth(child, side, collapsedIds));
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + Math.max(0, children.length - 1) * BRANCH_GAP;
  const dir = side === 'top' ? -1 : 1;
  let x = rootBox.x - totalWidth / 2;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const width = widths[index];
    const childBox = child._layout;

    childBox.side = side;
    childBox.x = x + width / 2;
    childBox.y = rootBox.y + dir * (rootBox.height / 2 + LEVEL_GAP + childBox.height / 2);

    placeVerticalDescendants(child, side, collapsedIds);
    x += width + BRANCH_GAP;
  }
}

/*
 * 作用：
 * 递归摆放竖向布局中的后代。
 */
export function placeVerticalDescendants(parent, side, collapsedIds) {
  const children = visibleChildren(parent, collapsedIds);
  if (!children.length) return;

  const parentBox = parent._layout;
  const widths = children.map((child) => verticalSubtreeWidth(child, side, collapsedIds));
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + Math.max(0, children.length - 1) * SIBLING_GAP;
  const dir = side === 'top' ? -1 : 1;
  let x = parentBox.x - totalWidth / 2;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const width = widths[index];
    const childBox = child._layout;

    childBox.side = side;
    childBox.x = x + width / 2;
    childBox.y = parentBox.y + dir * (parentBox.height / 2 + LEVEL_GAP + childBox.height / 2);

    placeVerticalDescendants(child, side, collapsedIds);
    x += width + SIBLING_GAP;
  }
}

/*
 * 作用：
 * 计算竖向布局中一个子树需要的水平宽度。
 */
export function verticalSubtreeWidth(node, side, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  if (!children.length) return box.width;

  const childWidth =
    children.reduce((sum, child) => sum + verticalSubtreeWidth(child, side, collapsedIds), 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;

  return Math.max(box.width, childWidth);
}

/*
 * 作用：
 * 树形结构布局，覆盖向右树、向左树和平衡树。
 *
 * 实现逻辑：
 * 旧版 tree 是按深度优先逐行摆放，节点多时不会给子树预留空间，容易挤在一起。
 * 这里改成先计算每棵子树需要的高度，再把父节点放在子树高度的中线位置。
 * 这样每个分支都拥有自己的纵向空间，后代节点不会和相邻分支重叠。
 */
export function layoutOutlineTree(root, collapsedIds, mode = 'tree') {
  const rootChildren = visibleChildren(root, collapsedIds);
  placeTreeTrunkChildren(root, rootChildren, mode, collapsedIds);
}

/*
 * 作用：
 * 沿中心节点下方的纵向主干摆放一级分支。
 *
 * 关键点：
 * 树状结构和普通脑图的最大区别在一级分支：普通脑图从中心点左右展开，
 * 树状结构则先形成一条自上而下的主干，再把一级分支挂在主干左右。
 */
export function placeTreeTrunkChildren(root, children, mode, collapsedIds) {
  if (!children.length) return;

  const rootBox = root._layout;
  const sides = children.map((child, index) => rootChildTreeSide(child, index, mode));
  const heights = children.map((child, index) =>
    treeSubtreeHeight(child, sides[index], collapsedIds)
  );
  let y = rootBox.y + rootBox.height / 2 + LEVEL_GAP;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const childBox = child._layout;
    const height = heights[index];
    const side = sides[index];
    const dir = side === 'tree-left' ? -1 : 1;

    childBox.side = side;
    childBox.x = rootBox.x + dir * (LEVEL_GAP + childBox.width / 2);
    childBox.y = y + height / 2;

    placeTreeDescendants(child, side, collapsedIds);
    y += height + BRANCH_GAP;
  }

  // 中心节点保持在树的顶部中间；整体 bounds 会自然包含下方所有一级分支。
  // 这里不调用 centerVisibleNodes，避免把顶部根节点又拉回普通脑图的视觉中心。
}

/*
 * 作用：
 * 判断树状结构的一级分支挂在主干哪一侧。
 */
export function rootChildTreeSide(child, index, mode) {
  const childLayout = normalizeLayout(child.attrs.layout);
  if (childLayout === 'left' || childLayout === 'tree-left') return 'tree-left';
  if (childLayout === 'right' || childLayout === 'tree') return 'tree-right';

  if (mode === 'tree-left') return 'tree-left';
  if (mode === 'tree-balanced') return index % 2 === 0 ? 'tree-right' : 'tree-left';
  return 'tree-right';
}

/*
 * 作用：
 * 递归摆放树状结构中的后代节点。
 *
 * 实现逻辑：
 * 同一个父节点下的所有子节点先计算总高度，再围绕父节点的 y 坐标上下展开。
 * 父节点因此会自然位于子树的视觉中线，连线也更像常见树图结构。
 */
export function placeTreeDescendants(parent, side, collapsedIds) {
  const children = visibleChildren(parent, collapsedIds);
  if (!children.length) return;

  const parentBox = parent._layout;
  const heights = children.map((child) => treeSubtreeHeight(child, side, collapsedIds));
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;
  const dir = side === 'tree-left' ? -1 : 1;
  let y = parentBox.y - totalHeight / 2;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const childBox = child._layout;
    const height = heights[index];

    childBox.side = side;
    childBox.x = parentBox.x + dir * (parentBox.width / 2 + LEVEL_GAP + childBox.width / 2);
    childBox.y = y + height / 2;

    placeTreeDescendants(child, side, collapsedIds);
    y += height + SIBLING_GAP;
  }
}

/*
 * 作用：
 * 计算树状结构中一个子树实际需要占用的高度。
 *
 * 为什么不直接复用节点高度：
 * 一个节点本身可能只有一行高，但它下面可能挂着很多后代。
 * 如果只看节点高度，兄弟分支就会彼此重叠；所以这里递归累加可见子树高度。
 */
export function treeSubtreeHeight(node, side, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  if (!children.length) return box.height;

  const childHeight =
    children.reduce((sum, child) => sum + treeSubtreeHeight(child, side, collapsedIds), 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;

  return Math.max(box.height, childHeight);
}

/*
 * 作用：
 * 组织架构图布局。
 *
 * 结构区别：
 * - org：标准组织结构图，父节点在上，子节点横向排布在下一层。
 * - org-right：下右展开结构，一级节点横向排列，后代从各自分支向右下展开。
 */
export function layoutOrgChart(root, collapsedIds, mode = 'org') {
  if (mode === 'org-right') {
    placeOrgRightRootChildren(root, visibleChildren(root, collapsedIds), collapsedIds);
    return;
  }

  const levelTops = orgLevelTops(root, collapsedIds);
  placeOrgSubtree(root, 0, 0, levelTops, collapsedIds);
}

/*
 * 作用：
 * 递归摆放组织架构图子树，并返回子树宽度。
 *
 * 实现逻辑：
 * 标准组织结构图需要按“层级”对齐，而不是按每个父节点的高度单独下移。
 * 因此 y 坐标先从 levelTops 读取同层统一顶部，再加上节点自身高度的一半。
 * 这样长文案节点只会向下撑开，不会向上顶到父级连线区域。
 */
export function placeOrgSubtree(node, centerX, depth, levelTops, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  const subtreeWidth = orgSubtreeWidth(node, collapsedIds);

  box.side = box.side === 'root' ? 'root' : 'org-bottom';
  box.x = centerX;
  box.y = (levelTops[depth] || 0) + box.height / 2;

  if (!children.length) return subtreeWidth;

  const childGroupWidth = orgChildrenWidth(children, collapsedIds);
  let x = centerX - childGroupWidth / 2;

  for (const child of children) {
    const width = orgSubtreeWidth(child, collapsedIds);
    placeOrgSubtree(child, x + width / 2, depth + 1, levelTops, collapsedIds);
    x += width + SIBLING_GAP;
  }

  return subtreeWidth;
}

/*
 * 作用：
 * 计算标准组织结构图每一层的统一顶部 y 坐标。
 *
 * 关键点：
 * 组织结构图更适合顶部对齐：长文案节点会向下变高，而不是围绕中心线上下扩张。
 * 下一层根据上一层最大高度统一下移，所以不同父节点下的同层子节点仍然保持齐平。
 */
export function orgLevelTops(root, collapsedIds) {
  const levelHeights = [];

  const visit = (node, depth) => {
    const box = node._layout;
    levelHeights[depth] = Math.max(levelHeights[depth] || 0, box.height);

    for (const child of visibleChildren(node, collapsedIds)) {
      visit(child, depth + 1);
    }
  };

  visit(root, 0);

  const levelTops = [0];
  for (let depth = 1; depth < levelHeights.length; depth += 1) {
    levelTops[depth] = levelTops[depth - 1] + levelHeights[depth - 1] + LEVEL_GAP;
  }

  return levelTops;
}

/*
 * 作用：
 * 计算组织架构图子树宽度。
 */
export function orgSubtreeWidth(node, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  if (!children.length) return box.width;

  const childWidth = orgChildrenWidth(children, collapsedIds);

  return Math.max(box.width, childWidth);
}

/*
 * 作用：
 * 计算一组组织结构图子节点横向排布所需的总宽度。
 */
export function orgChildrenWidth(children, collapsedIds) {
  return (
    children.reduce((sum, child) => sum + orgSubtreeWidth(child, collapsedIds), 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP
  );
}

/*
 * 作用：
 * 摆放“下右展开”组织结构图的一级节点。
 *
 * 实现逻辑：
 * 一级分支主题和标准组织图一样横向排列；每个一级分支再把自己的后代向右下展开。
 * 因此横向槽位不能只看一级节点宽度，还要把该分支右侧子树的宽度算进去。
 */
export function placeOrgRightRootChildren(root, children, collapsedIds) {
  if (!children.length) return;

  const rootBox = root._layout;
  const widths = children.map((child) => orgRightSubtreeWidth(child, collapsedIds));
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + Math.max(0, children.length - 1) * BRANCH_GAP;
  const maxRootChildHeight = children.reduce(
    (max, child) => Math.max(max, child._layout.height),
    NODE_MIN_HEIGHT
  );
  const childY = rootBox.y + rootBox.height / 2 + LEVEL_GAP + maxRootChildHeight / 2;
  const descendantStartTop = childY - maxRootChildHeight / 2 + maxRootChildHeight + SIBLING_GAP;
  const rowTops = orgRightDescendantGridTops(children, descendantStartTop, collapsedIds);
  let x = rootBox.x - totalWidth / 2;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const childBox = child._layout;
    const width = widths[index];

    childBox.side = 'org-right-branch';
    childBox.x = x + childBox.width / 2;
    childBox.y = childY - maxRootChildHeight / 2 + childBox.height / 2;

    placeOrgRightDescendants(child, collapsedIds, rowTops);
    x += width + BRANCH_GAP;
  }
}

/*
 * 作用：
 * 递归摆放“下右展开”组织结构图的后代节点。
 *
 * 实现逻辑：
 * 子节点不是从父节点右侧展开，而是从父节点下方的竖向主线挂出。
 * 因此子节点的左边界按“父节点中心 + 缩进”计算，形成竖线向下、横线向右的目录树观感。
 * rowTops 是全局行表：按“层级 + 兄弟序号”共享同一个顶部 y。
 * 这样不同分支里的同级节点会自然横向对齐，长文案只会撑开当前行高。
 */
export function placeOrgRightDescendants(parent, collapsedIds, rowTops, depth = 0) {
  const children = visibleChildren(parent, collapsedIds);
  if (!children.length) return;

  const parentBox = parent._layout;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const childBox = child._layout;
    const top =
      rowTops[depth]?.[index] ?? parentBox.y + parentBox.height / 2 + SIBLING_GAP + index * 48;

    childBox.side = 'org-right';
    childBox.x = parentBox.x + LEVEL_GAP + childBox.width / 2;
    childBox.y = top + childBox.height / 2;

    placeOrgRightDescendants(child, collapsedIds, rowTops, depth + 1);
  }
}

/*
 * 作用：
 * 计算 org-right 后代的全局网格行顶部。
 *
 * 设计思路：
 * 第一维是相对层级，第二维是兄弟序号。
 * 例如所有一级分支下的第一个子节点共享 depth=0/index=0 的行。
 */
export function orgRightDescendantGridTops(rootChildren, startTop, collapsedIds) {
  const gridHeights = [];

  for (const child of rootChildren) {
    collectOrgRightGridHeights(child, collapsedIds, gridHeights);
  }

  const rowTops = [];
  let y = startTop;
  for (let depth = 0; depth < gridHeights.length; depth += 1) {
    rowTops[depth] = [];
    const heights = gridHeights[depth] || [];
    for (let index = 0; index < heights.length; index += 1) {
      const height = heights[index] || NODE_MIN_HEIGHT;
      rowTops[depth][index] = y;
      y += height + SIBLING_GAP;
    }
  }

  return rowTops;
}

/*
 * 作用：
 * 按“层级 + 兄弟序号”统计 org-right 每个网格行所需高度。
 */
export function collectOrgRightGridHeights(parent, collapsedIds, gridHeights, depth = 0) {
  const children = visibleChildren(parent, collapsedIds);
  if (!children.length) return;

  if (!gridHeights[depth]) {
    gridHeights[depth] = [];
  }

  children.forEach((child, index) => {
    gridHeights[depth][index] = Math.max(gridHeights[depth][index] || 0, child._layout.height);
    collectOrgRightGridHeights(child, collapsedIds, gridHeights, depth + 1);
  });
}

/*
 * 作用：
 * 计算“下右展开”组织结构图中一个分支向右展开后需要占用的水平宽度。
 */
export function orgRightSubtreeWidth(node, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  if (!children.length) return box.width;

  const childWidth = children.reduce(
    (max, child) => Math.max(max, orgRightSubtreeWidth(child, collapsedIds)),
    0
  );

  return Math.max(box.width, box.width / 2 + LEVEL_GAP + childWidth);
}

/*
 * 作用：
 * 时间轴布局，覆盖轴上展开、轴下展开和上下平衡轴。
 *
 * 实现逻辑：
 * 二级节点是时间轴上的时间点，始终落在同一条水平轴线上。
 * 三级及更深节点才根据模式展开到轴上方或轴下方，并向右递进。
 */
export function layoutTimeline(root, collapsedIds, mode = 'timeline') {
  const rootBox = root._layout;
  const children = visibleChildren(root, collapsedIds);
  if (!children.length) return;

  const branchSides = children.map((child, index) => rootChildTimelineSide(child, index, mode));
  const widths = children.map((child) => timelinePointWidth(child, collapsedIds));
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + Math.max(0, children.length - 1) * BRANCH_GAP;

  const axisY = rootBox.y;
  rootBox.timelineAxisY = axisY;
  rootBox.timelineAxisMinX = rootBox.x + rootBox.width / 2;
  rootBox.timelineAxisMaxX = rootBox.x + rootBox.width / 2 + LEVEL_GAP + totalWidth;

  let x = rootBox.x + rootBox.width / 2 + LEVEL_GAP;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const childBox = child._layout;
    const width = widths[index];
    const branchSide = branchSides[index];

    childBox.side = 'timeline-point';
    childBox.timelineBranchSide = branchSide;
    childBox.x = x + childBox.width / 2;
    childBox.y = axisY;
    childBox.timelineAxisY = axisY;

    placeTimelineDetails(child, branchSide, collapsedIds);
    x += width + BRANCH_GAP;
  }
}

/*
 * 作用：
 * 判断时间轴一级节点挂在轴线上方还是下方。
 */
export function rootChildTimelineSide(child, index, mode) {
  const childLayout = normalizeLayout(child.attrs.layout);
  if (childLayout === 'timeline-up' || childLayout === 'up') return 'timeline-top';
  if (childLayout === 'timeline' || childLayout === 'down') return 'timeline-bottom';

  if (mode === 'timeline-up') return 'timeline-top';
  if (mode === 'timeline-balanced') return index % 2 === 0 ? 'timeline-top' : 'timeline-bottom';
  return 'timeline-bottom';
}

/*
 * 作用：
 * 摆放某个时间点的详情子树。
 *
 * 实现逻辑：
 * 时间点本身在轴线上；详情节点从时间点上方或下方拉出一条竖线，
 * 再在竖线右侧逐层递进，形成时间轴常见的事件详情区。
 */
export function placeTimelineDetails(parent, branchSide, collapsedIds) {
  const children = visibleChildren(parent, collapsedIds);
  if (!children.length) return;

  const parentBox = parent._layout;
  const heights = children.map((child) =>
    timelineDetailSubtreeHeight(child, branchSide, collapsedIds)
  );
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;
  const isDetailParent =
    parentBox.side === 'timeline-detail-top' || parentBox.side === 'timeline-detail-bottom';
  let y = isDetailParent
    ? parentBox.y - totalHeight / 2
    : branchSide === 'timeline-top'
      ? parentBox.y - parentBox.height / 2 - SIBLING_GAP - totalHeight
      : parentBox.y + parentBox.height / 2 + SIBLING_GAP;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const childBox = child._layout;
    const height = heights[index];
    const isTopBranch = branchSide === 'timeline-top';

    childBox.side = isTopBranch ? 'timeline-detail-top' : 'timeline-detail-bottom';
    childBox.timelineBranchSide = branchSide;
    childBox.x = parentBox.x + LEVEL_GAP + childBox.width / 2;
    /*
     * 每个节点都放在自己完整子树占位块的中线位置。
     * 这样当某个详情节点继续展开子节点时，父节点右侧出口能自然对齐子节点组的总高度中线。
     */
    childBox.y = y + height / 2;

    placeTimelineDetails(child, branchSide, collapsedIds);
    y += height + SIBLING_GAP;
  }
}

/*
 * 作用：
 * 计算某个时间点连同详情区需要占用的横向宽度。
 */
export function timelinePointWidth(node, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  if (!children.length) return box.width;

  const childWidth = children.reduce(
    (max, child) => Math.max(max, timelinePointWidth(child, collapsedIds)),
    0
  );

  return Math.max(box.width, box.width / 2 + LEVEL_GAP + childWidth);
}

/*
 * 作用：
 * 计算时间轴详情子树需要占用的垂直高度。
 */
export function timelineDetailSubtreeHeight(node, branchSide, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  if (!children.length) return box.height;

  const childHeight =
    children.reduce(
      (sum, child) => sum + timelineDetailSubtreeHeight(child, branchSide, collapsedIds),
      0
    ) +
    Math.max(0, children.length - 1) * SIBLING_GAP;

  /*
   * 详情树是向右展开的：父节点和子节点组在横向上分列，垂直占位取二者较大值。
   * 如果继续使用“父节点高度 + 子节点组高度”，会把子树块算得过高，
   * 也会让父节点出口无法对齐子节点组中线。
   */
  return Math.max(box.height, childHeight);
}

/*
 * 作用：
 * 放射布局，一级分支环绕中心节点分布，后代沿各自射线向外延伸。
 *
 * 实现逻辑：
 * 一级节点决定一条从中心向外发散的主射线。
 * 后代不再继续绕圆旋转，而是沿这条主射线向外推进；
 * 同级节点沿射线的垂直方向排开，形成真正的“中心发散”结构。
 */
export function layoutRadial(root, collapsedIds) {
  const children = visibleChildren(root, collapsedIds);
  const radius = Math.max(220, root._layout.width / 2 + LEVEL_GAP + 110);
  const stats = children.map((child) => radialBranchStats(child, collapsedIds));
  const weights = stats.map((stat) => radialBranchWeight(stat));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const slices = weights.map((weight) => (weight / totalWeight) * Math.PI * 2);
  let cursor = -Math.PI / 2 - (slices[0] || 0) / 2;

  children.forEach((child, index) => {
    const slice = slices[index];
    const angle = cursor + slice / 2;
    const branchRadius = radialBranchRadius(radius, child, angle, slice, collapsedIds);

    placeRadialRootBranch(root, child, angle, branchRadius, collapsedIds);
    cursor += slice;
  });
}

/*
 * 作用：
 * 摆放放射图的一级分支。
 */
export function placeRadialRootBranch(root, node, angle, radius, collapsedIds) {
  const box = node._layout;
  const unit = radialUnit(angle);

  box.side = radialSide(angle);
  box.radialAngle = angle;
  box.x = root._layout.x + unit.x * radius;
  box.y = root._layout.y + unit.y * radius;

  placeRadialDescendants(node, angle, collapsedIds);
}

/*
 * 作用：
 * 递归摆放放射图某条射线上的后代节点。
 *
 * 实现逻辑：
 * 当前节点作为父节点，子节点整体沿同一射线继续向外；
 * 多个子节点沿射线垂直方向分散，并让子节点组的中线对齐父节点出口。
 */
export function placeRadialDescendants(parent, angle, collapsedIds) {
  const children = visibleChildren(parent, collapsedIds);
  if (!children.length) return;

  const parentBox = parent._layout;
  const unit = radialUnit(angle);
  const normal = radialNormal(angle);
  const breadths = children.map((child) => radialSubtreeBreadth(child, angle, collapsedIds));
  const totalBreadth =
    breadths.reduce((sum, breadth) => sum + breadth, 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;
  const parentForward = radialExtent(parentBox, angle);
  let offset = -totalBreadth / 2;

  children.forEach((child, index) => {
    const childBox = child._layout;
    const breadth = breadths[index];
    const childForward = radialExtent(childBox, angle);
    const along = parentForward + LEVEL_GAP + childForward;
    const cross = offset + breadth / 2;

    childBox.side = radialSide(angle);
    childBox.radialAngle = angle;
    childBox.x = parentBox.x + unit.x * along + normal.x * cross;
    childBox.y = parentBox.y + unit.y * along + normal.y * cross;

    placeRadialDescendants(child, angle, collapsedIds);
    offset += breadth + SIBLING_GAP;
  });
}

/*
 * 作用：
 * 计算放射图中某棵子树沿射线垂直方向需要占用的宽度。
 */
export function radialSubtreeBreadth(node, angle, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  const ownBreadth = radialPerpendicularExtent(box, angle) * 2;
  if (!children.length) return ownBreadth;

  const childBreadth =
    children.reduce((sum, child) => sum + radialSubtreeBreadth(child, angle, collapsedIds), 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;

  return Math.max(ownBreadth, childBreadth);
}

/*
 * 作用：
 * 统计一级放射分支的复杂度，供角度动态分配使用。
 */
export function radialBranchStats(node, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  let descendantCount = children.length;
  let maxDepth = children.length ? 1 : 0;

  for (const child of children) {
    const childStats = radialBranchStats(child, collapsedIds);
    descendantCount += childStats.descendantCount;
    maxDepth = Math.max(maxDepth, childStats.maxDepth + 1);
  }

  return {
    directChildCount: children.length,
    descendantCount,
    maxDepth,
    sizeScore: Math.max(0, (box.width - NODE_MIN_WIDTH) / NODE_MIN_WIDTH) + box.height / 120,
  };
}

/*
 * 作用：
 * 根据分支复杂度计算角度权重。
 *
 * 设计思路：
 * 直接子节点数量对扇区大小影响最大；后代数量用平方根压缩，避免超大分支吃掉整圈；
 * 深度和节点尺寸作为补偿，照顾长文本节点和深层分支。
 */
export function radialBranchWeight(stat) {
  return (
    1 +
    stat.directChildCount * 0.75 +
    Math.sqrt(stat.descendantCount) * 0.55 +
    stat.maxDepth * 0.35 +
    stat.sizeScore * 0.35
  );
}

/*
 * 作用：
 * 根据分支内容和扇区宽度微调一级分支半径。
 *
 * 为什么需要半径补偿：
 * 有些分支虽然已经拿到更大角度，但如果子树非常宽，仍然可能靠近相邻扇区。
 * 适当把它推远，可以让同样的垂直展开宽度占据更小的视觉角度。
 */
export function radialBranchRadius(baseRadius, node, angle, slice, collapsedIds) {
  const breadth = radialSubtreeBreadth(node, angle, collapsedIds);
  const safeHalfAngle = Math.max(0.18, Math.min(slice * 0.36, Math.PI / 3));
  const requiredRadius = breadth / 2 / Math.tan(safeHalfAngle);

  return Math.max(baseRadius, Math.min(baseRadius + 220, requiredRadius));
}

/*
 * 作用：
 * 根据角度给放射节点归类，供连线锚点和按钮方向使用。
 */
function radialSide(angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  if (Math.abs(cos) >= Math.abs(sin)) return cos >= 0 ? 'right' : 'left';
  return sin >= 0 ? 'bottom' : 'top';
}

/*
 * 作用：
 * 计算射线方向单位向量。
 */
function radialUnit(angle) {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

/*
 * 作用：
 * 计算与射线垂直的单位向量，用来分散同级节点。
 */
function radialNormal(angle) {
  return {
    x: -Math.sin(angle),
    y: Math.cos(angle),
  };
}

/*
 * 作用：
 * 计算节点矩形在射线方向上的半径投影。
 */
function radialExtent(box, angle) {
  const unit = radialUnit(angle);
  return (Math.abs(unit.x) * box.width + Math.abs(unit.y) * box.height) / 2;
}

/*
 * 作用：
 * 计算节点矩形在射线垂直方向上的半径投影。
 */
function radialPerpendicularExtent(box, angle) {
  const normal = radialNormal(angle);
  return (Math.abs(normal.x) * box.width + Math.abs(normal.y) * box.height) / 2;
}

/*
 * 作用：
 * 根据折叠状态返回当前节点实际可见的子节点列表。
 */
export function visibleChildren(node, collapsedIds) {
  if (collapsedIds.has(node.id)) return [];
  return node.children;
}

/*
 * 作用：
 * 收集当前可见节点和父子连线关系，供 SVG 渲染层使用。
 */
export function collectVisible(node, collapsedIds, nodes, edges) {
  nodes.push(node);
  for (const child of visibleChildren(node, collapsedIds)) {
    edges.push({ parent: node, child });
    collectVisible(child, collapsedIds, nodes, edges);
  }
}

/*
 * 作用：
 * 根据所有可见节点的盒子范围计算整张图的边界。
 */
export function computeBounds(nodes) {
  if (!nodes.length) {
    return { minX: -120, minY: -80, maxX: 120, maxY: 80 };
  }

  return nodes.reduce(
    (bounds, node) => {
      const box = node._layout;
      bounds.minX = Math.min(bounds.minX, box.x - box.width / 2);
      bounds.maxX = Math.max(bounds.maxX, box.x + box.width / 2);
      bounds.minY = Math.min(bounds.minY, box.y - box.height / 2);
      bounds.maxY = Math.max(bounds.maxY, box.y + box.height / 2);
      return bounds;
    },
    {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    }
  );
}
