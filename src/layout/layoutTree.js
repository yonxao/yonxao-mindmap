/*
 * 文件作用：
 * 这里负责把树形数据计算成可绘制的节点坐标和连线关系。
 *
 * 执行逻辑：
 * 1. prepareNode 先测量每个节点的宽高和换行文本。
 * 2. 根节点放在坐标原点。
 * 3. rootChildSide 根据 layout 属性决定第一层节点在左侧、右侧或平衡分布。
 * 4. placeRootSide / placeDescendants 递归摆放各级节点。
 * 5. collectVisible 收集未折叠的节点和边，computeBounds 计算整体边界。
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
  LINE_HEIGHT,
  ICON_SIZE,
  ICON_GAP,
} from '../constants.js';
import { normalizeIcon } from '../icons/renderIcon.js';
import { clamp } from '../utils/math.js';
import { visualUnits, wrapLabel } from '../utils/text.js';

/*
 * 作用：
 * 计算整棵思维导图的可见节点、连线和整体边界。
 *
 * 调用链：
 * YonxaoMindmapRenderer.renderGraph() -> layoutTree() -> renderNode()/renderEdge()。
 *
 * 实现逻辑：
 * 先测量节点，再按左右侧递归摆放，最后收集未折叠节点和 bounds。
 */
export function layoutTree(root, collapsedIds) {
  // 布局总流程：
  // 1. measureNode 估算每个节点的宽高。
  // 2. 根节点放在原点。
  // 3. 根据 layout 属性把第一层子节点分配到左右两侧。
  // 4. 递归给每个子树分配坐标，并计算整体 bounds 供 fitView 使用。
  prepareNode(root);

  const rootBox = root._layout;
  rootBox.x = 0;
  rootBox.y = 0;
  rootBox.side = 'root';

  const visibleRootChildren = visibleChildren(root, collapsedIds);
  const rightChildren = [];
  const leftChildren = [];

  visibleRootChildren.forEach((child, index) => {
    const side = rootChildSide(root, child, index);
    if (side === 'left') {
      leftChildren.push(child);
    } else {
      rightChildren.push(child);
    }
  });

  placeRootSide(root, rightChildren, 'right', collapsedIds);
  placeRootSide(root, leftChildren, 'left', collapsedIds);

  const nodes = [];
  const edges = [];
  collectVisible(root, collapsedIds, nodes, edges);

  return {
    nodes,
    edges,
    bounds: computeBounds(nodes),
  };
}

/*
 * 作用：
 * 为每个节点预先写入 _layout 测量结果。
 *
 * 实现逻辑：
 * 深度优先遍历整棵树；后续布局阶段只读取 _layout，不再重复测量。
 */
export function prepareNode(node) {
  // 先测量所有节点，后续布局才能根据真实盒子尺寸分配空间。
  node._layout = measureNode(node);
  for (const child of node.children) {
    prepareNode(child);
  }
}

/*
 * 作用：
 * 根据节点文本、图标和常量配置估算节点宽高。
 *
 * 调用链：
 * prepareNode() -> measureNode()；renderNode() 会直接使用这里写出的 lines/textX/textY。
 */
export function measureNode(node) {
  const icon = normalizeIcon(node.attrs.icon);
  const maxUnits = icon ? 18 : 22;
  // SVG text 没有天然的自动换行，这里用“视觉宽度”做一个轻量估算。
  // 中文字符按 2 个单位，英文按 1 个单位，避免中文标签撑破节点。
  const lines = wrapLabel(node.text || 'Untitled', maxUnits);
  const longest = lines.reduce((max, line) => Math.max(max, visualUnits(line)), 0);
  const iconWidth = icon ? ICON_SIZE + ICON_GAP : 0;
  const textWidth = Math.ceil(longest * 7.5);
  // clamp 保证极短标题不会太窄，极长标题也不会撑破画布。
  const width = clamp(textWidth + NODE_PADDING_X * 2 + iconWidth, NODE_MIN_WIDTH, NODE_MAX_WIDTH);
  const height = Math.max(NODE_MIN_HEIGHT, lines.length * LINE_HEIGHT + NODE_PADDING_Y * 2);

  return {
    width,
    height,
    lines,
    icon,
    textX: NODE_PADDING_X + iconWidth,
    textY: (height - (lines.length - 1) * LINE_HEIGHT) / 2 + 5,
    side: 'right',
    x: 0,
    y: 0,
  };
}

/*
 * 作用：
 * 判断根节点的某个一级子节点应该放在左侧还是右侧。
 *
 * 实现逻辑：
 * 子节点 layout 优先级最高，其次根节点 layout；都没有时用 balanced 交替分布。
 */
export function rootChildSide(root, child, index) {
  const childLayout = normalizeLayout(child.attrs.layout);
  if (childLayout === 'left' || childLayout === 'right') return childLayout;

  const rootLayout = normalizeLayout(root.attrs.layout);
  if (rootLayout === 'left' || rootLayout === 'right') return rootLayout;

  // balanced 模式下第一层节点左右交替分布，尽量避免一侧过长。
  return index % 2 === 0 ? 'right' : 'left';
}

/*
 * 作用：
 * 规范化 layout 属性，只允许 left/right/balanced 三种有效值。
 */
export function normalizeLayout(layout) {
  const value = String(layout || '')
    .trim()
    .toLowerCase();
  if (value === 'left' || value === 'right' || value === 'balanced') {
    return value;
  }
  return '';
}

/*
 * 作用：
 * 摆放根节点某一侧的所有一级子树。
 *
 * 调用链：
 * layoutTree() -> placeRootSide() -> placeDescendants()。
 */
export function placeRootSide(root, children, side, collapsedIds) {
  if (!children.length) return;

  const rootBox = root._layout;
  const heights = children.map((child) => subtreeHeight(child, side, collapsedIds));
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, children.length - 1) * BRANCH_GAP;

  // 先算整组子树高度，再从上到下摆放；这样父节点会自然位于这组节点的中线附近。
  let y = rootBox.y - totalHeight / 2;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const height = heights[index];
    const childBox = child._layout;
    const dir = side === 'left' ? -1 : 1;

    // x 根据左右方向移动；y 取当前子树高度中点，让子树围绕自己的中心展开。
    childBox.side = side;
    childBox.x = rootBox.x + dir * (rootBox.width / 2 + LEVEL_GAP + childBox.width / 2);
    childBox.y = y + height / 2;

    placeDescendants(child, side, collapsedIds);
    y += height + BRANCH_GAP;
  }
}

/*
 * 作用：
 * 递归摆放非根节点的后代节点。
 *
 * 实现逻辑：
 * 与 placeRootSide 类似，但同级间距使用更紧凑的 SIBLING_GAP。
 */
export function placeDescendants(parent, side, collapsedIds) {
  const children = visibleChildren(parent, collapsedIds);
  if (!children.length) return;

  const parentBox = parent._layout;
  const heights = children.map((child) => subtreeHeight(child, side, collapsedIds));
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

    placeDescendants(child, side, collapsedIds);
    y += height + SIBLING_GAP;
  }
}

/*
 * 作用：
 * 计算一个节点展开后的子树高度。
 *
 * 调用链：
 * placeRootSide()/placeDescendants() -> subtreeHeight()。
 */
export function subtreeHeight(node, side, collapsedIds) {
  const box = node._layout;
  const children = visibleChildren(node, collapsedIds);
  if (!children.length) return box.height;

  // 子树高度要考虑折叠状态：折叠后只保留当前节点自身高度。
  const childHeight =
    children.reduce((sum, child) => sum + subtreeHeight(child, side, collapsedIds), 0) +
    Math.max(0, children.length - 1) * SIBLING_GAP;

  return Math.max(box.height, childHeight);
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
 *
 * 调用链：
 * layoutTree() -> computeBounds() -> renderer.fitView()。
 */
export function computeBounds(nodes) {
  if (!nodes.length) {
    return { minX: -120, minY: -80, maxX: 120, maxY: 80 };
  }

  // bounds 用来计算 viewBox，从而让“适配视图”能把全部节点收入可视区。
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
