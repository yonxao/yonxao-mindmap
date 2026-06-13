/*
 * 文件作用：
 * 这里负责把树形数据计算成可绘制的主题坐标和连线关系。
 *
 * 执行逻辑：
 * 1. prepareTopic 先测量每个主题的宽高和换行文本。
 * 2. layoutTree 根据 layout.defaultDirection 选择布局策略。
 * 3. 各布局策略只负责写入 topic._layout.x/y/side。
 * 4. collectVisible 收集未折叠主题和连线，computeBounds 计算整体边界。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer.renderMap() -> layoutTree() -> renderTopic()/renderEdge()
 */

import {
  LEVEL_GAP,
  SIBLING_GAP,
  BRANCH_GAP,
  TOPIC_PADDING_X,
  TOPIC_PADDING_Y,
  TOPIC_MIN_WIDTH,
  TOPIC_MAX_WIDTH,
  TOPIC_MIN_HEIGHT,
  ICON_SIZE,
  ICON_GAP,
} from '../constants.js';
import { normalizeMindConfig, resolveTopicFont } from '../config/mindConfig.js';
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
  'fishbone',
  'tree-table',
  'tree-table-stepped',
]);

/*
 * 作用：
 * 计算整棵思维导图的可见主题、连线和整体边界。
 *
 * 设计思路：
 * 不同布局共享“测量主题”和“收集主题”的流程，只把坐标分配拆成多个策略。
 * 这样新增布局不会破坏已经稳定的水平 mind map 布局。
 */
export function layoutTree(root, collapsedIds, config) {
  const normalizedConfig = normalizeMindConfig(config);
  prepareTopic(root, normalizedConfig);

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
  } else if (mode === 'fishbone') {
    layoutFishbone(root, collapsedIds);
  } else if (mode === 'tree-table') {
    layoutTreeTable(root, collapsedIds, { fillLeafRemainderColumns: true });
  } else if (mode === 'tree-table-stepped') {
    layoutTreeTable(root, collapsedIds, { fillLeafRemainderColumns: false });
  } else {
    layoutHorizontalMind(root, collapsedIds, mode);
  }

  const topics = [];
  const edges = [];
  collectVisible(root, collapsedIds, topics, edges);

  return {
    topics,
    edges,
    bounds: computeBounds(topics),
    mode,
  };
}

/*
 * 作用：
 * 为每个主题预先写入 _layout 测量结果。
 */
export function prepareTopic(topic, config) {
  topic._layout = measureTopic(topic, config);
  for (const child of topic.children) {
    prepareTopic(child, config);
  }
}

/*
 * 作用：
 * 根据主题文本、图标和常量配置估算主题宽高。
 */
export function measureTopic(topic, config) {
  const normalizedConfig = normalizeMindConfig(config);
  const font = resolveTopicFont(topic, normalizedConfig);
  const icon = normalizeIcon(topic.attrs.icon);
  const maxWidth = normalizedConfig.topic.maxWidth || TOPIC_MAX_WIDTH;
  const iconWidth = icon ? ICON_SIZE + ICON_GAP : 0;
  const usableTextWidth = Math.max(48, maxWidth - TOPIC_PADDING_X * 2 - iconWidth);
  const averageUnitWidth = Math.max(5, font.size * 0.54);
  const maxUnits = clamp(Math.floor(usableTextWidth / averageUnitWidth), icon ? 10 : 12, 48);
  const lines = wrapLabel(topic.text || 'Untitled', maxUnits);
  const longest = lines.reduce((max, line) => Math.max(max, visualUnits(line)), 0);
  const textWidth = Math.ceil(longest * averageUnitWidth);
  const width = clamp(textWidth + TOPIC_PADDING_X * 2 + iconWidth, TOPIC_MIN_WIDTH, maxWidth);
  const height = Math.max(TOPIC_MIN_HEIGHT, lines.length * font.lineHeight + TOPIC_PADDING_Y * 2);

  return {
    width,
    height,
    lines,
    icon,
    font,
    textX: TOPIC_PADDING_X + iconWidth,
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
 * 根主题属性 layout > 配置区 layout.defaultDirection > balanced。
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
 * 判断一级主题应该在左侧还是右侧。
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
 * 摆放根主题某一侧的一级子树。
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
export function horizontalSubtreeHeight(topic, side, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
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
 * 判断一级主题应该在上方还是下方。
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
 * 摆放竖向布局中根主题某一侧的一级子树。
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
export function verticalSubtreeWidth(topic, side, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
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
 * 旧版 tree 是按深度优先逐行摆放，主题多时不会给子树预留空间，容易挤在一起。
 * 这里改成先计算每棵子树需要的高度，再把父主题放在子树高度的中线位置。
 * 这样每个分支都拥有自己的纵向空间，后代主题不会和相邻分支重叠。
 */
export function layoutOutlineTree(root, collapsedIds, mode = 'tree') {
  const rootChildren = visibleChildren(root, collapsedIds);
  placeTreeTrunkChildren(root, rootChildren, mode, collapsedIds);
}

/*
 * 作用：
 * 沿中心主题下方的纵向主干摆放一级分支。
 *
 * 关键点：
 * 树状结构和普通导图的最大区别在一级分支：普通导图从中心点左右展开，
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

  // 中心主题保持在树的顶部中间；整体 bounds 会自然包含下方所有一级分支。
  // 这里不调用 centerVisibleTopics，避免把顶部根主题又拉回普通导图的视觉中心。
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
 * 递归摆放树状结构中的后代主题。
 *
 * 实现逻辑：
 * 同一个父主题下的所有子主题先计算总高度，再围绕父主题的 y 坐标上下展开。
 * 父主题因此会自然位于子树的视觉中线，连线也更像常见树图结构。
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
 * 为什么不直接复用主题高度：
 * 一个主题本身可能只有一行高，但它下面可能挂着很多后代。
 * 如果只看主题高度，兄弟分支就会彼此重叠；所以这里递归累加可见子树高度。
 */
export function treeSubtreeHeight(topic, side, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
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
 * - org：标准组织结构图，父主题在上，子主题横向排布在下一层。
 * - org-right：下右展开结构，一级主题横向排列，后代从各自分支向右下展开。
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
 * 标准组织结构图需要按“层级”对齐，而不是按每个父主题的高度单独下移。
 * 因此 y 坐标先从 levelTops 读取同层统一顶部，再加上主题自身高度的一半。
 * 这样长文案主题只会向下撑开，不会向上顶到父级连线区域。
 */
export function placeOrgSubtree(topic, centerX, depth, levelTops, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
  const subtreeWidth = orgSubtreeWidth(topic, collapsedIds);

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
 * 组织结构图更适合顶部对齐：长文案主题会向下变高，而不是围绕中心线上下扩张。
 * 下一层根据上一层最大高度统一下移，所以不同父主题下的同层子主题仍然保持齐平。
 */
export function orgLevelTops(root, collapsedIds) {
  const levelHeights = [];

  const visit = (topic, depth) => {
    const box = topic._layout;
    levelHeights[depth] = Math.max(levelHeights[depth] || 0, box.height);

    for (const child of visibleChildren(topic, collapsedIds)) {
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
export function orgSubtreeWidth(topic, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
  if (!children.length) return box.width;

  const childWidth = orgChildrenWidth(children, collapsedIds);

  return Math.max(box.width, childWidth);
}

/*
 * 作用：
 * 计算一组组织结构图子主题横向排布所需的总宽度。
 */
export function orgChildrenWidth(children, collapsedIds) {
  return (
    children.reduce((sum, child) => sum + orgSubtreeWidth(child, collapsedIds), 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP
  );
}

/*
 * 作用：
 * 摆放“下右展开”组织结构图的一级主题。
 *
 * 实现逻辑：
 * 一级分支主题和标准组织图一样横向排列；每个一级分支再把自己的后代向右下展开。
 * 因此横向槽位不能只看一级主题宽度，还要把该分支右侧子树的宽度算进去。
 */
export function placeOrgRightRootChildren(root, children, collapsedIds) {
  if (!children.length) return;

  const rootBox = root._layout;
  const widths = children.map((child) => orgRightSubtreeWidth(child, collapsedIds));
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + Math.max(0, children.length - 1) * BRANCH_GAP;
  const maxRootChildHeight = children.reduce(
    (max, child) => Math.max(max, child._layout.height),
    TOPIC_MIN_HEIGHT
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
 * 递归摆放“下右展开”组织结构图的后代主题。
 *
 * 实现逻辑：
 * 子主题不是从父主题右侧展开，而是从父主题下方的竖向主线挂出。
 * 因此子主题的左边界按“父主题中心 + 缩进”计算，形成竖线向下、横线向右的目录树观感。
 * rowTops 是全局行表：按“层级 + 兄弟序号”共享同一个顶部 y。
 * 这样不同分支里的同级主题会自然横向对齐，长文案只会撑开当前行高。
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
 * 例如所有一级分支下的第一个子主题共享 depth=0/index=0 的行。
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
      const height = heights[index] || TOPIC_MIN_HEIGHT;
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
export function orgRightSubtreeWidth(topic, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
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
 * 二级主题是时间轴上的时间点，始终落在同一条水平轴线上。
 * 三级及更深主题才根据模式展开到轴上方或轴下方，并向右递进。
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
 * 判断时间轴一级主题挂在轴线上方还是下方。
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
 * 时间点本身在轴线上；详情主题从时间点上方或下方拉出一条竖线，
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
     * 每个主题都放在自己完整子树占位块的中线位置。
     * 这样当某个详情主题继续展开子主题时，父主题右侧出口能自然对齐子主题组的总高度中线。
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
export function timelinePointWidth(topic, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
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
export function timelineDetailSubtreeHeight(topic, branchSide, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
  if (!children.length) return box.height;

  const childHeight =
    children.reduce(
      (sum, child) => sum + timelineDetailSubtreeHeight(child, branchSide, collapsedIds),
      0
    ) +
    Math.max(0, children.length - 1) * SIBLING_GAP;

  /*
   * 详情树是向右展开的：父主题和子主题组在横向上分列，垂直占位取二者较大值。
   * 如果继续使用“父主题高度 + 子主题组高度”，会把子树块算得过高，
   * 也会让父主题出口无法对齐子主题组中线。
   */
  return Math.max(box.height, childHeight);
}

/*
 * 作用：
 * 放射布局，一级分支环绕中心主题分布，后代沿各自射线向外延伸。
 *
 * 实现逻辑：
 * 一级主题决定一条从中心向外发散的主射线。
 * 后代不再继续绕圆旋转，而是沿这条主射线向外推进；
 * 同级主题沿射线的垂直方向排开，形成真正的“中心发散”结构。
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
export function placeRadialRootBranch(root, topic, angle, radius, collapsedIds) {
  const box = topic._layout;
  const unit = radialUnit(angle);

  box.side = radialSide(angle);
  box.radialAngle = angle;
  box.x = root._layout.x + unit.x * radius;
  box.y = root._layout.y + unit.y * radius;

  placeRadialDescendants(topic, angle, collapsedIds);
}

/*
 * 作用：
 * 递归摆放放射图某条射线上的后代主题。
 *
 * 实现逻辑：
 * 当前主题作为父主题，子主题整体沿同一射线继续向外；
 * 多个子主题沿射线垂直方向分散，并让子主题组的中线对齐父主题出口。
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
export function radialSubtreeBreadth(topic, angle, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
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
export function radialBranchStats(topic, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
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
    sizeScore: Math.max(0, (box.width - TOPIC_MIN_WIDTH) / TOPIC_MIN_WIDTH) + box.height / 120,
  };
}

/*
 * 作用：
 * 根据分支复杂度计算角度权重。
 *
 * 设计思路：
 * 直接子主题数量对扇区大小影响最大；后代数量用平方根压缩，避免超大分支吃掉整圈；
 * 深度和主题尺寸作为补偿，照顾长文本主题和深层分支。
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
export function radialBranchRadius(baseRadius, topic, angle, slice, collapsedIds) {
  const breadth = radialSubtreeBreadth(topic, angle, collapsedIds);
  const safeHalfAngle = Math.max(0.18, Math.min(slice * 0.36, Math.PI / 3));
  const requiredRadius = breadth / 2 / Math.tan(safeHalfAngle);

  return Math.max(baseRadius, Math.min(baseRadius + 220, requiredRadius));
}

/*
 * 作用：
 * 根据角度给放射主题归类，供连线锚点和按钮方向使用。
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
 * 计算与射线垂直的单位向量，用来分散同级主题。
 */
function radialNormal(angle) {
  return {
    x: -Math.sin(angle),
    y: Math.cos(angle),
  };
}

/*
 * 作用：
 * 计算主题矩形在射线方向上的半径投影。
 */
function radialExtent(box, angle) {
  const unit = radialUnit(angle);
  return (Math.abs(unit.x) * box.width + Math.abs(unit.y) * box.height) / 2;
}

/*
 * 作用：
 * 计算主题矩形在射线垂直方向上的半径投影。
 */
function radialPerpendicularExtent(box, angle) {
  const normal = radialNormal(angle);
  return (Math.abs(normal.x) * box.width + Math.abs(normal.y) * box.height) / 2;
}

/*
 * 作用：
 * 鱼骨图布局，中心主题在左侧，一级分支交替挂在主骨上下。
 *
 * 实现逻辑：
 * - 根主题右侧延伸出一条水平主骨。
 * - 一级主题按照上下交替的方式挂到主骨上，形成鱼骨的大斜骨。
 * - 二级主题挂在斜骨中段。
 * - 三级及更深主题从二级主题右侧继续树状展开。
 */
export function layoutFishbone(root, collapsedIds) {
  const rootBox = root._layout;
  const children = visibleChildren(root, collapsedIds);
  if (!children.length) return;

  const diagonalX = Math.max(72, LEVEL_GAP);
  const firstAttachX = rootBox.x + rootBox.width / 2 + LEVEL_GAP;
  const sideCursors = {
    top: firstAttachX,
    bottom: firstAttachX + LEVEL_GAP * 0.45,
  };

  children.forEach((child, index) => {
    const childBox = child._layout;
    const sign = index % 2 === 0 ? -1 : 1;
    const sideKey = sign < 0 ? 'top' : 'bottom';
    const subtreeHeight = fishboneSubtreeHeight(child, collapsedIds);
    const subtreeWidth = fishboneSubtreeWidth(child, collapsedIds);
    const attachX = sideCursors[sideKey];
    const childLeft = attachX + diagonalX + Math.max(0, subtreeHeight - TOPIC_MIN_HEIGHT) * 0.18;

    childBox.side = sign < 0 ? 'fishbone-top' : 'fishbone-bottom';
    childBox.fishboneSign = sign;
    childBox.fishboneAttachX = attachX;
    childBox.x = childLeft + childBox.width / 2;
    childBox.y =
      rootBox.y + sign * (TOPIC_MIN_HEIGHT + SIBLING_GAP * 2 + subtreeHeight + childBox.height / 2);
    childBox.fishboneBoneStartX = attachX;
    childBox.fishboneBoneStartY = rootBox.y;
    childBox.fishboneBoneEndX = childBox.x;
    childBox.fishboneBoneEndY =
      sign < 0 ? childBox.y + childBox.height / 2 : childBox.y - childBox.height / 2;

    placeFishboneRibs(child, sign, collapsedIds);
    sideCursors[sideKey] += diagonalX + subtreeWidth + BRANCH_GAP * 0.35;
  });
}

/*
 * 作用：
 * 摆放鱼骨图中挂在斜骨上的二级主题。
 */
export function placeFishboneRibs(parent, sign, collapsedIds) {
  const children = visibleChildren(parent, collapsedIds);
  if (!children.length) return;

  const parentBox = parent._layout;
  const boneStartX = parentBox.fishboneBoneStartX;
  const boneStartY = parentBox.fishboneBoneStartY;
  const boneEndX = parentBox.fishboneBoneEndX;
  const boneEndY = parentBox.fishboneBoneEndY;
  const ribHeights = children.map((child) => fishboneDetailSubtreeHeight(child, collapsedIds));
  const totalRibHeight =
    ribHeights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;
  const boneHeight = Math.abs(boneEndY - boneStartY);
  const usableHeight = Math.max(1, boneHeight - parentBox.height - SIBLING_GAP * 2);
  const contentStart = SIBLING_GAP + Math.max(0, (usableHeight - totalRibHeight) / 2);
  let offset = 0;

  children.forEach((child, index) => {
    const childBox = child._layout;
    const height = ribHeights[index];
    const centerOnBone = contentStart + offset + height / 2;
    const childY = boneEndY - sign * centerOnBone;
    const ratio = clamp((childY - boneStartY) / (boneEndY - boneStartY || 1), 0, 1);
    const attachX = boneStartX + (boneEndX - boneStartX) * ratio;
    const attachY = childY;

    childBox.side = 'fishbone-rib';
    childBox.fishboneSign = sign;
    childBox.fishboneAttachX = attachX;
    childBox.fishboneAttachY = attachY;
    childBox.x = attachX + LEVEL_GAP + childBox.width / 2;
    childBox.y = childY;

    placeFishboneDetails(child, sign, collapsedIds);
    offset += height + SIBLING_GAP;
  });
}

/*
 * 作用：
 * 摆放鱼骨图三级及更深主题。
 */
export function placeFishboneDetails(parent, sign, collapsedIds) {
  const children = visibleChildren(parent, collapsedIds);
  if (!children.length) return;

  const parentBox = parent._layout;
  const heights = children.map((child) => fishboneDetailSubtreeHeight(child, collapsedIds));
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;
  let y = parentBox.y - totalHeight / 2;

  children.forEach((child, index) => {
    const childBox = child._layout;
    const height = heights[index];

    childBox.side = 'fishbone-detail';
    childBox.fishboneSign = sign;
    childBox.x = parentBox.x + parentBox.width / 2 + LEVEL_GAP + childBox.width / 2;
    childBox.y = y + height / 2;

    placeFishboneDetails(child, sign, collapsedIds);
    y += height + SIBLING_GAP;
  });
}

/*
 * 作用：
 * 计算鱼骨图子树需要占用的垂直高度。
 */
export function fishboneSubtreeHeight(topic, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
  if (!children.length) return box.height;

  const ribHeight =
    children.reduce((sum, child) => sum + fishboneDetailSubtreeHeight(child, collapsedIds), 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;

  return Math.max(box.height, ribHeight);
}

/*
 * 作用：
 * 计算鱼骨图三级及更深主题需要占用的垂直高度。
 */
export function fishboneDetailSubtreeHeight(topic, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
  if (!children.length) return box.height;

  const childHeight =
    children.reduce((sum, child) => sum + fishboneDetailSubtreeHeight(child, collapsedIds), 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;

  return Math.max(box.height, childHeight);
}

/*
 * 作用：
 * 计算鱼骨图子树从一级分支主题开始向右延伸的宽度。
 */
export function fishboneSubtreeWidth(topic, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
  if (!children.length) return box.width;

  const childWidth = children.reduce(
    (max, child) => Math.max(max, fishboneDetailSubtreeWidth(child, collapsedIds)),
    0
  );

  return Math.max(box.width, LEVEL_GAP + childWidth);
}

/*
 * 作用：
 * 计算鱼骨图三级及更深主题向右延伸的宽度。
 */
export function fishboneDetailSubtreeWidth(topic, collapsedIds) {
  const box = topic._layout;
  const children = visibleChildren(topic, collapsedIds);
  if (!children.length) return box.width;

  const childWidth = children.reduce(
    (max, child) => Math.max(max, fishboneDetailSubtreeWidth(child, collapsedIds)),
    0
  );

  return box.width + LEVEL_GAP + childWidth;
}

/*
 * 作用：
 * 树形表格布局，根主题作为表头，后代主题按层级展开为表格列。
 *
 * 实现逻辑：
 * 1. 先统计每一列需要的宽度，避免同列单元格忽宽忽窄。
 * 2. 再递归计算每个主题的子树高度；有子主题的父单元格会纵向合并。
 * 3. 最后按照 top/height 把每个主题放进自己的单元格。
 *
 * 参数说明：
 * fillLeafRemainderColumns 控制叶子主题是否横向填满剩余列。
 * - true：标准树形表格，叶子主题合并右侧空列，表格外轮廓更规整。
 * - false：树形阶梯表格，叶子主题只占当前列，保留阶梯状轮廓。
 */
export function layoutTreeTable(root, collapsedIds, options = {}) {
  const fillLeafRemainderColumns = options.fillLeafRemainderColumns !== false;
  const rootBox = root._layout;
  const columnWidths = treeTableColumnWidths(root, collapsedIds);
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const headerHeight = Math.max(rootBox.height + TOPIC_PADDING_Y * 2, TOPIC_MIN_HEIGHT * 1.6);

  rootBox.side = 'tree-table-root';
  rootBox.width = Math.max(rootBox.width, tableWidth);
  rootBox.height = headerHeight;
  rootBox.x = 0;
  rootBox.y = headerHeight / 2;
  recenterTopicText(rootBox);

  const children = visibleChildren(root, collapsedIds);
  if (!children.length) return;

  const bodyTop = headerHeight;
  const tableLeft = -tableWidth / 2;
  const columnLefts = treeTableColumnLefts(columnWidths, tableLeft);
  const childHeights = children.map((child) => treeTableSubtreeHeight(child, collapsedIds));
  let cursorTop = bodyTop;

  children.forEach((child, index) => {
    const allocatedHeight = childHeights[index];
    placeTreeTableTopic(
      child,
      0,
      cursorTop,
      allocatedHeight,
      columnLefts,
      columnWidths,
      collapsedIds,
      { fillLeafRemainderColumns }
    );
    cursorTop += allocatedHeight;
  });
}

/*
 * 作用：
 * 统计树形表格每一列的宽度。
 *
 * 变量说明：
 * columnIndex 从 0 开始；根主题是表头，不占正文列，所以根主题的直接子主题在第 0 列。
 * 每列取该列所有主题宽度的最大值，并设置一个最小宽度，保证表格不会因为短文本变得太窄。
 */
export function treeTableColumnWidths(root, collapsedIds) {
  const columnWidths = [];
  const minColumnWidth = Math.max(TOPIC_MIN_WIDTH, 120);

  const visit = (topic, columnIndex) => {
    const box = topic._layout;
    columnWidths[columnIndex] = Math.max(columnWidths[columnIndex] || minColumnWidth, box.width);

    for (const child of visibleChildren(topic, collapsedIds)) {
      visit(child, columnIndex + 1);
    }
  };

  for (const child of visibleChildren(root, collapsedIds)) {
    visit(child, 0);
  }

  return columnWidths.length ? columnWidths : [minColumnWidth];
}

/*
 * 作用：
 * 根据列宽和表格左边界，计算每一列的左侧 x 坐标。
 */
export function treeTableColumnLefts(columnWidths, tableLeft) {
  const columnLefts = [];
  let cursorX = tableLeft;

  columnWidths.forEach((width, index) => {
    columnLefts[index] = cursorX;
    cursorX += width;
  });

  return columnLefts;
}

/*
 * 作用：
 * 计算树形表格中一个主题需要占用的总高度。
 *
 * 实现逻辑：
 * - 叶子主题至少占自己文本需要的高度。
 * - 父主题高度等于所有子主题高度之和。
 * - 如果父主题文本更高，则用父主题高度兜底，后续布局时会把多出的高度分摊给子主题。
 */
export function treeTableSubtreeHeight(topic, collapsedIds) {
  const box = topic._layout;
  const ownHeight = Math.max(TOPIC_MIN_HEIGHT, box.height);
  const children = visibleChildren(topic, collapsedIds);
  if (!children.length) return ownHeight;

  const childrenHeight = children.reduce(
    (sum, child) => sum + treeTableSubtreeHeight(child, collapsedIds),
    0
  );

  return Math.max(ownHeight, childrenHeight);
}

/*
 * 作用：
 * 把主题和它的子树放入树形表格。
 *
 * 变量说明：
 * allocatedHeight 是当前主题拿到的完整单元格高度，类似表格 rowspan 后的高度。
 * childExtraHeight 是父单元格比子主题总高度多出来的部分；平均分给子主题，避免长文案父主题压住右侧子表格。
 */
export function placeTreeTableTopic(
  topic,
  columnIndex,
  topY,
  allocatedHeight,
  columnLefts,
  columnWidths,
  collapsedIds,
  options = {}
) {
  const box = topic._layout;
  const fillLeafRemainderColumns = options.fillLeafRemainderColumns !== false;
  const children = visibleChildren(topic, collapsedIds);
  const isLeafTopic = children.length === 0;
  const lastColumnIndex = Math.max(0, columnWidths.length - 1);
  const shouldFillRemainingColumns = fillLeafRemainderColumns && isLeafTopic;
  const columnWidth = shouldFillRemainingColumns
    ? columnWidths.slice(columnIndex).reduce((sum, width) => sum + width, 0)
    : columnWidths[columnIndex] || columnWidths[lastColumnIndex];
  const columnLeft = columnLefts[columnIndex] || columnLefts[columnLefts.length - 1];

  box.side = 'tree-table-cell';
  box.treeTableColumn = columnIndex;
  box.treeTableColumnSpan = shouldFillRemainingColumns ? lastColumnIndex - columnIndex + 1 : 1;
  box.width = columnWidth;
  box.height = allocatedHeight;
  box.x = columnLeft + columnWidth / 2;
  box.y = topY + allocatedHeight / 2;
  recenterTopicText(box);

  if (!children.length) return;

  const childBaseHeights = children.map((child) => treeTableSubtreeHeight(child, collapsedIds));
  const childBaseTotal = childBaseHeights.reduce((sum, height) => sum + height, 0);
  const childExtraHeight = Math.max(0, allocatedHeight - childBaseTotal);
  const childExtraHeightPerTopic = childExtraHeight / children.length;
  let childTop = topY;

  children.forEach((child, index) => {
    const childAllocatedHeight = childBaseHeights[index] + childExtraHeightPerTopic;
    placeTreeTableTopic(
      child,
      columnIndex + 1,
      childTop,
      childAllocatedHeight,
      columnLefts,
      columnWidths,
      collapsedIds,
      { fillLeafRemainderColumns }
    );
    childTop += childAllocatedHeight;
  });
}

/*
 * 作用：
 * 主题宽高被布局策略改写后，重新把多行文本垂直居中。
 */
export function recenterTopicText(box) {
  box.textY =
    (box.height - (box.lines.length - 1) * box.font.lineHeight) / 2 + box.font.size * 0.36;
}

/*
 * 作用：
 * 根据折叠状态返回当前主题实际可见的子主题列表。
 */
export function visibleChildren(topic, collapsedIds) {
  if (collapsedIds.has(topic.id)) return [];
  return topic.children;
}

/*
 * 作用：
 * 收集当前可见主题和父子连线关系，供 SVG 渲染层使用。
 */
export function collectVisible(topic, collapsedIds, topics, edges) {
  topics.push(topic);
  for (const child of visibleChildren(topic, collapsedIds)) {
    edges.push({ parent: topic, child });
    collectVisible(child, collapsedIds, topics, edges);
  }
}

/*
 * 作用：
 * 根据所有可见主题的盒子范围计算整张图的边界。
 */
export function computeBounds(topics) {
  if (!topics.length) {
    return { minX: -120, minY: -80, maxX: 120, maxY: 80 };
  }

  return topics.reduce(
    (bounds, topic) => {
      const box = topic._layout;
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
