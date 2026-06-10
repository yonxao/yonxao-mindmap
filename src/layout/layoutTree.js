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
  'org',
  'timeline',
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
  } else if (mode === 'tree') {
    layoutOutlineTree(root, collapsedIds);
  } else if (mode === 'org') {
    layoutOrgChart(root, collapsedIds);
  } else if (mode === 'timeline') {
    layoutTimeline(root, collapsedIds);
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
 * 树形大纲布局，类似文件树或幕布目录。
 *
 * 实现逻辑：
 * 节点按深度优先顺序从上到下排列，层级越深 x 越靠右。
 */
export function layoutOutlineTree(root, collapsedIds) {
  const rowGap = SIBLING_GAP + NODE_MIN_HEIGHT;
  const indent = LEVEL_GAP;
  let row = 0;

  const visit = (node, depth) => {
    const box = node._layout;
    box.side = depth === 0 ? 'root' : 'tree';
    box.x = depth * indent;
    box.y = row * rowGap;
    row += 1;

    for (const child of visibleChildren(node, collapsedIds)) {
      visit(child, depth + 1);
    }
  };

  visit(root, 0);
  centerVisibleNodes(root, collapsedIds);
}

/*
 * 作用：
 * 组织架构图布局，父节点在上，子节点横向排布在下。
 */
export function layoutOrgChart(root, collapsedIds) {
  placeOrgSubtree(root, 0, 0, collapsedIds);
}

/*
 * 作用：
 * 递归摆放组织架构图子树，并返回子树宽度。
 */
export function placeOrgSubtree(node, centerX, y, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  const subtreeWidth = orgSubtreeWidth(node, collapsedIds);

  box.side = box.side === 'root' ? 'root' : 'bottom';
  box.x = centerX;
  box.y = y;

  if (!children.length) return subtreeWidth;

  const childY = y + box.height / 2 + LEVEL_GAP + maxNodeHeight(children) / 2;
  let x = centerX - subtreeWidth / 2;

  for (const child of children) {
    const width = orgSubtreeWidth(child, collapsedIds);
    placeOrgSubtree(child, x + width / 2, childY, collapsedIds);
    x += width + SIBLING_GAP;
  }

  return subtreeWidth;
}

/*
 * 作用：
 * 计算组织架构图子树宽度。
 */
export function orgSubtreeWidth(node, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  if (!children.length) return box.width;

  const childWidth =
    children.reduce((sum, child) => sum + orgSubtreeWidth(child, collapsedIds), 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;

  return Math.max(box.width, childWidth);
}

/*
 * 作用：
 * 时间线布局，一级节点沿横轴排列，子节点作为事件详情向下展开。
 */
export function layoutTimeline(root, collapsedIds) {
  const rootBox = root._layout;
  const children = visibleChildren(root, collapsedIds);
  rootBox.x = 0;
  rootBox.y = 0;
  rootBox.side = 'root';

  let x = rootBox.x + rootBox.width / 2 + LEVEL_GAP;
  for (const child of children) {
    const width = Math.max(child._layout.width, orgSubtreeWidth(child, collapsedIds));
    child._layout.side = 'timeline';
    child._layout.x = x + width / 2;
    child._layout.y = 0;
    placeTimelineDetails(child, collapsedIds);
    x += width + LEVEL_GAP;
  }

  centerVisibleNodes(root, collapsedIds);
}

/*
 * 作用：
 * 时间线一级节点的详情子树向下展开。
 */
export function placeTimelineDetails(parent, collapsedIds) {
  const children = visibleChildren(parent, collapsedIds);
  if (!children.length) return;

  const parentBox = parent._layout;
  const widths = children.map((child) => verticalSubtreeWidth(child, 'bottom', collapsedIds));
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + Math.max(0, children.length - 1) * SIBLING_GAP;
  let x = parentBox.x - totalWidth / 2;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const childBox = child._layout;
    const width = widths[index];
    childBox.side = 'bottom';
    childBox.x = x + width / 2;
    childBox.y = parentBox.y + parentBox.height / 2 + LEVEL_GAP + childBox.height / 2;
    placeVerticalDescendants(child, 'bottom', collapsedIds);
    x += width + SIBLING_GAP;
  }
}

/*
 * 作用：
 * 放射布局，一级分支环绕中心节点分布，后代沿同一射线向外延伸。
 */
export function layoutRadial(root, collapsedIds) {
  const children = visibleChildren(root, collapsedIds);
  const radius = Math.max(180, root._layout.width + LEVEL_GAP);

  children.forEach((child, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(children.length, 1);
    placeRadialBranch(child, angle, radius, 1, collapsedIds);
  });
}

/*
 * 作用：
 * 递归摆放放射布局的一条分支。
 */
export function placeRadialBranch(node, angle, radius, depth, collapsedIds) {
  const box = node._layout;
  box.side = radialSide(angle);
  box.x = Math.cos(angle) * radius;
  box.y = Math.sin(angle) * radius;

  const children = visibleChildren(node, collapsedIds);
  if (!children.length) return;

  const spread = Math.min(Math.PI / 2, Math.PI / Math.max(3, depth + children.length));
  const start = angle - spread / 2;
  const nextRadius = radius + LEVEL_GAP + Math.max(box.width, box.height);

  children.forEach((child, index) => {
    const childAngle =
      children.length === 1 ? angle : start + (spread * index) / Math.max(1, children.length - 1);
    placeRadialBranch(child, childAngle, nextRadius, depth + 1, collapsedIds);
  });
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
 * 将树形/时间线这类自然从左上展开的布局居中到根节点附近。
 */
function centerVisibleNodes(root, collapsedIds) {
  const nodes = [];
  collectVisible(root, collapsedIds, nodes, []);
  const bounds = computeBounds(nodes);
  const rootBox = root._layout;
  const offsetX = rootBox.x - (bounds.minX + bounds.maxX) / 2;
  const offsetY = rootBox.y - (bounds.minY + bounds.maxY) / 2;

  for (const node of nodes) {
    node._layout.x += offsetX;
    node._layout.y += offsetY;
  }
}

/*
 * 作用：
 * 返回一组节点中的最大高度。
 */
function maxNodeHeight(nodes) {
  return nodes.reduce((max, node) => Math.max(max, node._layout.height), NODE_MIN_HEIGHT);
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
