/*
 * 文件作用：
 * 这里负责把树形数据计算成可绘制的主题坐标和连线关系。
 *
 * 执行逻辑：
 * 1. prepareTopic 先测量每个主题的宽高和换行文本。
 * 2. layoutTree 根据 layout 布局类型选择布局策略。
 * 3. 各布局策略只负责写入 topic._layout.x/y/side。
 * 4. collectVisible 收集未折叠主题和连线，computeBounds 计算整体边界。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer.renderMap() -> layoutTree() -> renderTopic()/renderConnector()
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
import { visualUnits, wrapTopicText } from '../utils/text.js';

export const LAYOUT_TYPES = Object.freeze([
  'mindmap-right',
  'mindmap-left',
  'mindmap-bidirectional',
  'mindmap-down',
  'mindmap-up',
  'mindmap-vertical',
  'tree-right',
  'tree-left',
  'tree',
  'org',
  'org-right',
  'timeline-up',
  'timeline-down',
  'timeline',
  'radial',
  'fishbone-left',
  'fishbone-right',
  'tree-table',
  'tree-table-stepped',
]);

/*
 * 右向组织结构图的后代主题更像“挂在竖线上的紧凑目录树”。
 * 如果直接使用全局 LEVEL_GAP/SIBLING_GAP，小尺寸主题之间会显得线段过长、空白过大。
 */
const ORG_RIGHT_DESCENDANT_LEVEL_GAP = Math.round(LEVEL_GAP * 0.62);
const ORG_RIGHT_DESCENDANT_SIBLING_GAP = Math.max(8, Math.round(SIBLING_GAP * 0.56));

/*
 * 时间轴详情区不是普通的“父子左右展开”，而是挂在时间轴竖线旁的事件详情树。
 * 如果直接复用全局间距，三四级主题很容易贴在一起；这里单独放大一点，
 * 让时间点下的详情内容读起来更像一组自然展开的事件说明。
 */
const TIMELINE_DETAIL_LEVEL_GAP = Math.round(LEVEL_GAP * 1.22);
const TIMELINE_DETAIL_SIBLING_GAP = Math.max(24, Math.round(SIBLING_GAP * 1.35));
const TIMELINE_DETAIL_HANGING_SIBLING_GAP = Math.max(
  TIMELINE_DETAIL_SIBLING_GAP,
  Math.round(SIBLING_GAP * 2.1)
);
const TIMELINE_AXIS_DETAIL_GAP = Math.max(30, Math.round(SIBLING_GAP * 1.7));

/*
 * 放射图的阅读体验更依赖“聚合感”：主题需要围绕中心聚在一起，而不是像普通导图一样
 * 每层都拉开很长距离。这里单独定义更紧凑的放射间距，避免整张图占用过多空白。
 */
const RADIAL_ROOT_RADIUS_MIN = 168;
const RADIAL_ROOT_RADIUS_EXTRA = 72;
const RADIAL_LEVEL_GAP = Math.round(LEVEL_GAP * 0.82);
const RADIAL_SIBLING_GAP = Math.max(16, Math.round(SIBLING_GAP * 0.9));
const RADIAL_RADIUS_EXTRA_LIMIT = Math.round(LEVEL_GAP * 1.35);
const RADIAL_COLLISION_MARGIN = 24;
const RADIAL_COLLISION_ITERATIONS = 24;
const HANGING_LEVEL_GAP = Math.round(LEVEL_GAP * 0.72);
const HANGING_SIBLING_GAP = SIBLING_GAP;
const FISHBONE_PRIMARY_BONE_ANGLE = Math.PI * 0.32;
const FISHBONE_PRIMARY_BONE_SLOPE = Math.tan(FISHBONE_PRIMARY_BONE_ANGLE);
const FISHBONE_PRIMARY_BONE_MIN_EDGE_OFFSET = Math.round(TOPIC_MIN_HEIGHT * 2.4);

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

/*
 * 作用：
 * 判断当前布局是否支持普通主题的子主题展开方式。
 */
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
 * 子主题展开方式只作用于三级及更深主题继续展开子主题。
 */
function shouldUseHangingExpansion(parent, branchExpansion) {
  return branchExpansion === 'hanging' && Number(parent?.level || 1) >= 3;
}

/*
 * 作用：
 * 在垂直堆叠的占位块中计算主题 y 坐标。
 *
 * 关键点：
 * 如果这个主题自己会继续下挂展开，它的后代会从它下方长出；
 * 因此主题必须靠近占位块顶部，而不是放在整块中线，否则后代会溢出并压住后续兄弟主题。
 */
function verticalBlockTopicY(blockTop, blockHeight, topic, branchExpansion) {
  const box = topic._layout;
  return (
    blockTop +
    (shouldUseHangingExpansion(topic, branchExpansion) ? box.height / 2 : blockHeight / 2)
  );
}

/*
 * 作用：
 * 在水平堆叠的占位块中计算主题 x 坐标。
 *
 * 说明：
 * 这是 verticalBlockTopicY 的转置版本，用于向上/向下展开的思维导图。
 */
function horizontalBlockTopicX(blockLeft, blockWidth, topic, branchExpansion) {
  const box = topic._layout;
  return (
    blockLeft + (shouldUseHangingExpansion(topic, branchExpansion) ? box.width / 2 : blockWidth / 2)
  );
}

/*
 * 作用：
 * 计算水平下挂子树的横向占位。
 *
 * 关键点：
 * 下挂展开的目标是节省宽度，子主题横向位置应从父主题中心线继续偏移，
 * 而不是从父主题右边框之后再偏移。
 */
function horizontalHangingSubtreeWidth(box, subtopicWidth) {
  return Math.max(box.width, box.width / 2 + HANGING_LEVEL_GAP + subtopicWidth);
}

/*
 * 作用：
 * 时间轴详情区在下挂展开时需要更保守的同级间距。
 *
 * 原因：
 * 时间轴详情主题会沿同一侧竖向排列；下挂子主题再向下展开时，
 * 如果仍使用普通详情间距，视觉上很容易贴到下一条详情分支。
 */
function timelineDetailSiblingGapForParent(parent, branchExpansion) {
  return shouldUseHangingExpansion(parent, branchExpansion)
    ? TIMELINE_DETAIL_HANGING_SIBLING_GAP
    : TIMELINE_DETAIL_SIBLING_GAP;
}

/*
 * 作用：
 * 为每个主题预先写入 _layout 测量结果。
 */
export function prepareTopic(topic, config) {
  topic._layout = measureTopic(topic, config);
  for (const subtopic of topic.subtopics) {
    prepareTopic(subtopic, config);
  }
}

/*
 * 作用：
 * 根据主题文本、图标和常量配置估算主题宽高。
 */
export function measureTopic(topic, config) {
  const normalizedConfig = normalizeMindConfig(config);
  const font = resolveTopicFont(topic, normalizedConfig);
  const icon = normalizeIcon(topic.attributes.icon);
  const maxWidth = normalizedConfig.topic.maxWidth || TOPIC_MAX_WIDTH;
  const iconWidth = icon ? ICON_SIZE + ICON_GAP : 0;
  const usableTextWidth = Math.max(48, maxWidth - TOPIC_PADDING_X * 2 - iconWidth);
  const averageUnitWidth = Math.max(5, font.size * 0.54);
  const maxUnits = clamp(Math.floor(usableTextWidth / averageUnitWidth), icon ? 10 : 12, 48);
  const lines = wrapTopicText(topic.text || 'Untitled', maxUnits);
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

/*
 * 作用：
 * 水平思维导图布局，覆盖 mindmap-right/mindmap-left/mindmap-bidirectional。
 *
 * 说明：
 * 这是水平导图的策略化版本，用统一函数承载右向、左向和左右平衡体验。
 */
export function layoutHorizontalMind(root, collapsedIds, mode, branchExpansion = 'side') {
  const visibleRootSubtopics = visibleSubtopics(root, collapsedIds);
  const rightSubtopics = [];
  const leftSubtopics = [];

  visibleRootSubtopics.forEach((subtopic, index) => {
    const side = rootSubtopicHorizontalSide(index, mode);
    if (side === 'left') {
      leftSubtopics.push(subtopic);
    } else {
      rightSubtopics.push(subtopic);
    }
  });

  placeHorizontalRootSide(root, rightSubtopics, 'right', collapsedIds, branchExpansion);
  placeHorizontalRootSide(root, leftSubtopics, 'left', collapsedIds, branchExpansion);
}

/*
 * 作用：
 * 判断一级主题应该在左侧还是右侧。
 */
export function rootSubtopicHorizontalSide(index, mode) {
  if (mode === 'mindmap-left') return 'left';
  if (mode === 'mindmap-right') return 'right';
  return index % 2 === 0 ? 'right' : 'left';
}

/*
 * 作用：
 * 摆放根主题某一侧的一级子树。
 */
export function placeHorizontalRootSide(root, subtopics, side, collapsedIds, branchExpansion) {
  if (!subtopics.length) return;

  const rootBox = root._layout;
  const heights = subtopics.map((subtopic) =>
    horizontalSubtreeHeight(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * BRANCH_GAP;

  let y = rootBox.y - totalHeight / 2;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const height = heights[index];
    const subtopicBox = subtopic._layout;
    const dir = side === 'left' ? -1 : 1;

    subtopicBox.side = side;
    subtopicBox.x = rootBox.x + dir * (rootBox.width / 2 + LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeHorizontalDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += height + BRANCH_GAP;
  }
}

/*
 * 作用：
 * 递归摆放水平布局中的非根后代。
 */
export function placeHorizontalDescendants(parent, side, collapsedIds, branchExpansion = 'side') {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (shouldUseHangingExpansion(parent, branchExpansion)) {
    placeHorizontalHangingDescendants(parent, side, collapsedIds, branchExpansion);
    return;
  }

  const parentBox = parent._layout;
  const heights = subtopics.map((subtopic) =>
    horizontalSubtreeHeight(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * SIBLING_GAP;

  let y = parentBox.y - totalHeight / 2;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const height = heights[index];
    const subtopicBox = subtopic._layout;
    const dir = side === 'left' ? -1 : 1;

    subtopicBox.side = side;
    subtopicBox.x = parentBox.x + dir * (parentBox.width / 2 + LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeHorizontalDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += height + SIBLING_GAP;
  }
}

/*
 * 作用：
 * 水平布局的下挂展开：父主题从下方引出纵向支线，子主题再向左右侧接出。
 *
 * 说明：
 * 相比侧向展开，它不再从父主题侧边缘继续推进，从而减少横向占用；
 * 代价是父主题和子主题组会在垂直方向上串开，占用更多高度。
 */
export function placeHorizontalHangingDescendants(parent, side, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const heights = subtopics.map((subtopic) =>
    horizontalSubtreeHeight(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * HANGING_SIBLING_GAP;
  const dir = side === 'left' ? -1 : 1;
  let y = parentBox.y + parentBox.height / 2 + HANGING_SIBLING_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const height = heights[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x = parentBox.x + dir * (HANGING_LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeHorizontalDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += height + HANGING_SIBLING_GAP;
  }

  parentBox.hangingSubtopicsHeight = totalHeight;
}

/*
 * 作用：
 * 计算水平布局中一个子树需要的垂直高度。
 */
export function horizontalSubtreeHeight(topic, side, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.height;

  const subtopicHeight =
    subtopics.reduce(
      (sum, subtopic) =>
        sum + horizontalSubtreeHeight(subtopic, side, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) *
      (shouldUseHangingExpansion(topic, branchExpansion) ? HANGING_SIBLING_GAP : SIBLING_GAP);

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    return box.height + HANGING_SIBLING_GAP + subtopicHeight;
  }

  return Math.max(box.height, subtopicHeight);
}

/*
 * 作用：
 * 竖向思维导图布局，覆盖 mindmap-down/mindmap-up/mindmap-vertical。
 */
export function layoutVerticalMind(root, collapsedIds, mode, branchExpansion = 'side') {
  const visibleRootSubtopics = visibleSubtopics(root, collapsedIds);
  const bottomSubtopics = [];
  const topSubtopics = [];

  visibleRootSubtopics.forEach((subtopic, index) => {
    const side = rootSubtopicVerticalSide(index, mode);
    if (side === 'top') {
      topSubtopics.push(subtopic);
    } else {
      bottomSubtopics.push(subtopic);
    }
  });

  placeVerticalRootSide(root, bottomSubtopics, 'bottom', collapsedIds, branchExpansion);
  placeVerticalRootSide(root, topSubtopics, 'top', collapsedIds, branchExpansion);
}

/*
 * 作用：
 * 判断一级主题应该在上方还是下方。
 */
export function rootSubtopicVerticalSide(index, mode) {
  if (mode === 'mindmap-up') return 'top';
  if (mode === 'mindmap-down') return 'bottom';
  return index % 2 === 0 ? 'bottom' : 'top';
}

/*
 * 作用：
 * 摆放竖向布局中根主题某一侧的一级子树。
 */
export function placeVerticalRootSide(root, subtopics, side, collapsedIds, branchExpansion) {
  if (!subtopics.length) return;

  const rootBox = root._layout;
  const widths = subtopics.map((subtopic) =>
    verticalSubtreeWidth(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + Math.max(0, subtopics.length - 1) * BRANCH_GAP;
  const dir = side === 'top' ? -1 : 1;
  let x = rootBox.x - totalWidth / 2;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const width = widths[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.x = horizontalBlockTopicX(x, width, subtopic, branchExpansion);
    subtopicBox.y = rootBox.y + dir * (rootBox.height / 2 + LEVEL_GAP + subtopicBox.height / 2);

    placeVerticalDescendants(subtopic, side, collapsedIds, branchExpansion);
    x += width + BRANCH_GAP;
  }
}

/*
 * 作用：
 * 递归摆放竖向布局中的后代。
 */
export function placeVerticalDescendants(parent, side, collapsedIds, branchExpansion = 'side') {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (shouldUseHangingExpansion(parent, branchExpansion)) {
    placeVerticalHangingDescendants(parent, side, collapsedIds, branchExpansion);
    return;
  }

  const parentBox = parent._layout;
  const widths = subtopics.map((subtopic) =>
    verticalSubtreeWidth(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + Math.max(0, subtopics.length - 1) * SIBLING_GAP;
  const dir = side === 'top' ? -1 : 1;
  let x = parentBox.x - totalWidth / 2;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const width = widths[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.x = horizontalBlockTopicX(x, width, subtopic, branchExpansion);
    subtopicBox.y = parentBox.y + dir * (parentBox.height / 2 + LEVEL_GAP + subtopicBox.height / 2);

    placeVerticalDescendants(subtopic, side, collapsedIds, branchExpansion);
    x += width + SIBLING_GAP;
  }
}

/*
 * 作用：
 * 竖向布局的下挂展开：从主题侧边拉出一条横向支线，再向上/下接到子主题。
 *
 * 说明：
 * 这是水平下挂展开的转置版本，用更多横向空间换取更短的纵向推进距离。
 */
export function placeVerticalHangingDescendants(parent, side, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-vertical';
  const widths = subtopics.map((subtopic) =>
    verticalSubtreeWidth(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, subtopics.length - 1) * HANGING_SIBLING_GAP;
  const dir = side === 'top' ? -1 : 1;
  let x = parentBox.x + parentBox.width / 2 + HANGING_SIBLING_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const width = widths[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x = horizontalBlockTopicX(x, width, subtopic, branchExpansion);
    subtopicBox.y = parentBox.y + dir * (HANGING_LEVEL_GAP + subtopicBox.height / 2);

    placeVerticalDescendants(subtopic, side, collapsedIds, branchExpansion);
    x += width + HANGING_SIBLING_GAP;
  }

  parentBox.hangingSubtopicsWidth = totalWidth;
}

/*
 * 作用：
 * 计算竖向布局中一个子树需要的水平宽度。
 */
export function verticalSubtreeWidth(topic, side, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.width;

  const subtopicWidth =
    subtopics.reduce(
      (sum, subtopic) => sum + verticalSubtreeWidth(subtopic, side, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) *
      (shouldUseHangingExpansion(topic, branchExpansion) ? HANGING_SIBLING_GAP : SIBLING_GAP);

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    return box.width + HANGING_SIBLING_GAP + subtopicWidth;
  }

  return Math.max(box.width, subtopicWidth);
}

/*
 * 作用：
 * 树形结构布局，覆盖向右树、向左树和平衡树。
 *
 * 实现逻辑：
 * 树形图需要先计算每棵子树的高度，再把父主题放在子树高度的中线位置。
 * 这样每个分支都拥有自己的纵向空间，后代主题不会和相邻分支重叠。
 */
export function layoutOutlineTree(
  root,
  collapsedIds,
  mode = 'tree-right',
  branchExpansion = 'side'
) {
  const rootSubtopics = visibleSubtopics(root, collapsedIds);
  placeTreeTrunkSubtopics(root, rootSubtopics, mode, collapsedIds, branchExpansion);
}

/*
 * 作用：
 * 沿中心主题下方的纵向主干摆放一级分支。
 *
 * 关键点：
 * 树形图和普通导图的最大区别在一级分支：普通导图从中心点左右展开，
 * 树形图则先形成一条自上而下的主干，再把一级分支挂在主干左右。
 */
export function placeTreeTrunkSubtopics(root, subtopics, mode, collapsedIds, branchExpansion) {
  if (!subtopics.length) return;

  const sideEntries = {
    'tree-left': [],
    'tree-right': [],
  };
  subtopics.forEach((subtopic, index) => {
    const side = rootSubtopicTreeSide(index, mode);
    sideEntries[side].push({
      subtopic,
      side,
      height: treeSubtreeHeight(subtopic, side, collapsedIds, branchExpansion),
    });
  });

  placeTreeTrunkSide(root, sideEntries['tree-right'], collapsedIds, branchExpansion);
  placeTreeTrunkSide(root, sideEntries['tree-left'], collapsedIds, branchExpansion);

  // 中心主题保持在树的顶部中间；整体 bounds 会自然包含下方所有一级分支。
  // 这里不调用 centerVisibleTopics，避免把顶部根主题又拉回普通导图的视觉中心。
}

/*
 * 作用：
 * 紧凑摆放树形图主干某一侧的一级分支。
 *
 * 关键点：
 * 平衡树左右两侧互不重叠，因此可以各自独立堆叠；
 * 这样左侧大子树不会把右侧分支整体推空，反之亦然。
 */
export function placeTreeTrunkSide(root, entries, collapsedIds, branchExpansion) {
  if (!entries.length) return;

  const rootBox = root._layout;
  let y = rootBox.y + rootBox.height / 2 + LEVEL_GAP;

  for (const entry of entries) {
    const { subtopic, side, height } = entry;
    const subtopicBox = subtopic._layout;
    const dir = side === 'tree-left' ? -1 : 1;

    subtopicBox.side = side;
    subtopicBox.x = rootBox.x + dir * (LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeTreeDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += height + BRANCH_GAP;
  }
}

/*
 * 作用：
 * 判断树形图的一级分支挂在主干哪一侧。
 */
export function rootSubtopicTreeSide(index, mode) {
  if (mode === 'tree-left') return 'tree-left';
  if (mode === 'tree') return index % 2 === 0 ? 'tree-right' : 'tree-left';
  return 'tree-right';
}

/*
 * 作用：
 * 递归摆放树形图中的后代主题。
 *
 * 实现逻辑：
 * 同一个父主题下的所有子主题先计算总高度，再围绕父主题的 y 坐标上下展开。
 * 父主题因此会自然位于子树的视觉中线，连线也更像常见树图结构。
 */
export function placeTreeDescendants(parent, side, collapsedIds, branchExpansion = 'side') {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (shouldUseHangingExpansion(parent, branchExpansion)) {
    placeTreeHangingDescendants(parent, side, collapsedIds, branchExpansion);
    return;
  }

  const parentBox = parent._layout;
  const heights = subtopics.map((subtopic) =>
    treeSubtreeHeight(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * SIBLING_GAP;
  const dir = side === 'tree-left' ? -1 : 1;
  let y = parentBox.y - totalHeight / 2;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const height = heights[index];

    subtopicBox.side = side;
    subtopicBox.x = parentBox.x + dir * (parentBox.width / 2 + LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeTreeDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += height + SIBLING_GAP;
  }
}

/*
 * 作用：
 * 树形图的下挂展开，用父主题下方出口换取更短的横向推进距离。
 */
export function placeTreeHangingDescendants(parent, side, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const heights = subtopics.map((subtopic) =>
    treeSubtreeHeight(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * HANGING_SIBLING_GAP;
  const dir = side === 'tree-left' ? -1 : 1;
  let y = parentBox.y + parentBox.height / 2 + HANGING_SIBLING_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const height = heights[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x = parentBox.x + dir * (HANGING_LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeTreeDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += height + HANGING_SIBLING_GAP;
  }

  parentBox.hangingSubtopicsHeight = totalHeight;
}

/*
 * 作用：
 * 计算树形图中一个子树实际需要占用的高度。
 *
 * 为什么不直接复用主题高度：
 * 一个主题本身可能只有一行高，但它下面可能挂着很多后代。
 * 如果只看主题高度，兄弟分支就会彼此重叠；所以这里递归累加可见子树高度。
 */
export function treeSubtreeHeight(topic, side, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.height;

  const subtopicHeight =
    subtopics.reduce(
      (sum, subtopic) => sum + treeSubtreeHeight(subtopic, side, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) *
      (shouldUseHangingExpansion(topic, branchExpansion) ? HANGING_SIBLING_GAP : SIBLING_GAP);

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    return box.height + HANGING_SIBLING_GAP + subtopicHeight;
  }

  return Math.max(box.height, subtopicHeight);
}

/*
 * 作用：
 * 组织架构图布局。
 *
 * 结构区别：
 * - org：标准组织结构图，父主题在上，子主题横向排布在下一层。
 * - org-right：右向组织结构图，一级主题横向排列，后代从各自分支向右下展开。
 */
export function layoutOrgChart(root, collapsedIds, mode = 'org', branchExpansion = 'side') {
  if (mode === 'org-right') {
    placeOrgRightRootSubtopics(
      root,
      visibleSubtopics(root, collapsedIds),
      collapsedIds,
      branchExpansion
    );
    return;
  }

  const levelTops = orgLevelTops(root, collapsedIds);
  placeOrgSubtree(root, 0, 0, levelTops, collapsedIds, branchExpansion);
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
export function placeOrgSubtree(
  topic,
  centerX,
  depth,
  levelTops,
  collapsedIds,
  branchExpansion = 'side'
) {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const subtreeWidth = orgSubtreeWidth(topic, collapsedIds, branchExpansion);

  box.side = box.side === 'root' ? 'root' : 'org-bottom';
  box.x = centerX;
  box.y = (levelTops[depth] || 0) + box.height / 2;

  if (!subtopics.length) return subtreeWidth;

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    placeOrgHangingDescendants(topic, collapsedIds, branchExpansion);
    return subtreeWidth;
  }

  const subtopicGroupWidth = orgSubtopicsWidth(subtopics, collapsedIds, branchExpansion);
  let x = centerX - subtopicGroupWidth / 2;

  for (const subtopic of subtopics) {
    const width = orgSubtreeWidth(subtopic, collapsedIds, branchExpansion);
    placeOrgSubtree(
      subtopic,
      horizontalBlockTopicX(x, width, subtopic, branchExpansion),
      depth + 1,
      levelTops,
      collapsedIds,
      branchExpansion
    );
    x += width + SIBLING_GAP;
  }

  return subtreeWidth;
}

/*
 * 作用：
 * 标准组织结构图的深层下挂展开。
 */
export function placeOrgHangingDescendants(parent, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const heights = subtopics.map((subtopic) =>
    orgHangingSubtreeHeight(subtopic, collapsedIds, branchExpansion)
  );
  let y = parentBox.y + parentBox.height / 2 + HANGING_SIBLING_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const height = heights[index];

    subtopicBox.side = 'org-hanging';
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x = parentBox.x + HANGING_LEVEL_GAP + subtopicBox.width / 2;
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeOrgHangingDescendants(subtopic, collapsedIds, branchExpansion);
    y += height + HANGING_SIBLING_GAP;
  }
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

    for (const subtopic of visibleSubtopics(topic, collapsedIds)) {
      visit(subtopic, depth + 1);
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
export function orgSubtreeWidth(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.width;

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    const hangingWidth = subtopics.reduce(
      (max, subtopic) => Math.max(max, orgSubtreeWidth(subtopic, collapsedIds, branchExpansion)),
      0
    );
    return horizontalHangingSubtreeWidth(box, hangingWidth);
  }

  const subtopicWidth = orgSubtopicsWidth(subtopics, collapsedIds, branchExpansion);

  return Math.max(box.width, subtopicWidth);
}

/*
 * 作用：
 * 计算一组组织结构图子主题横向排布所需的总宽度。
 */
export function orgSubtopicsWidth(subtopics, collapsedIds, branchExpansion = 'side') {
  return (
    subtopics.reduce(
      (sum, subtopic) => sum + orgSubtreeWidth(subtopic, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) * SIBLING_GAP
  );
}

/*
 * 作用：
 * 估算标准组织结构图下挂子树的纵向占位。
 */
export function orgHangingSubtreeHeight(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.height;

  const subtopicHeight =
    subtopics.reduce(
      (sum, subtopic) => sum + orgHangingSubtreeHeight(subtopic, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) * HANGING_SIBLING_GAP;

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    return box.height + HANGING_SIBLING_GAP + subtopicHeight;
  }

  return Math.max(box.height, subtopicHeight);
}

/*
 * 作用：
 * 摆放“右向组织结构图”的一级主题。
 *
 * 实现逻辑：
 * 一级分支主题和标准组织图一样横向排列；每个一级分支再把自己的后代向右下展开。
 * 因此横向槽位不能只看一级主题宽度，还要把该分支右侧子树的宽度算进去。
 */
export function placeOrgRightRootSubtopics(root, subtopics, collapsedIds, branchExpansion) {
  if (!subtopics.length) return;

  const rootBox = root._layout;
  const widths = subtopics.map((subtopic) =>
    orgRightSubtreeWidth(subtopic, collapsedIds, branchExpansion)
  );
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + Math.max(0, subtopics.length - 1) * BRANCH_GAP;
  const maxRootSubtopicHeight = subtopics.reduce(
    (max, subtopic) => Math.max(max, subtopic._layout.height),
    TOPIC_MIN_HEIGHT
  );
  const subtopicY = rootBox.y + rootBox.height / 2 + LEVEL_GAP + maxRootSubtopicHeight / 2;
  let x = rootBox.x - totalWidth / 2;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const width = widths[index];

    subtopicBox.side = 'org-right-branch';
    subtopicBox.x = x + subtopicBox.width / 2;
    subtopicBox.y = subtopicY - maxRootSubtopicHeight / 2 + subtopicBox.height / 2;

    placeOrgRightDescendants(subtopic, collapsedIds, branchExpansion);
    x += width + BRANCH_GAP;
  }
}

/*
 * 作用：
 * 递归摆放“右向组织结构图”的后代主题。
 *
 * 实现逻辑：
 * 子主题不是从父主题右侧直接散开，而是从父主题下方的竖向主线挂出。
 * 但普通主题展开时要像右向树形图一样，为每个子树预留真实高度。
 * 这样某个子主题继续展开后代时，不会和相邻兄弟主题互相重叠。
 */
export function placeOrgRightDescendants(parent, collapsedIds, branchExpansion = 'side') {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (Number(parent?.level || 1) >= 3 && branchExpansion === 'side') {
    placeOrgRightSideDescendants(parent, collapsedIds, branchExpansion);
    return;
  }

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const heights = subtopics.map((subtopic) =>
    orgRightSubtreeHeight(subtopic, collapsedIds, branchExpansion)
  );
  let y = parentBox.y + parentBox.height / 2 + ORG_RIGHT_DESCENDANT_SIBLING_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const height = heights[index];

    subtopicBox.side = 'org-right';
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x =
      branchExpansion === 'hanging'
        ? parentBox.x + HANGING_LEVEL_GAP + subtopicBox.width / 2
        : parentBox.x +
          parentBox.width / 2 +
          ORG_RIGHT_DESCENDANT_LEVEL_GAP +
          subtopicBox.width / 2;
    subtopicBox.y =
      branchExpansion === 'hanging'
        ? verticalBlockTopicY(y, height, subtopic, branchExpansion)
        : y + subtopicBox.height / 2;

    placeOrgRightDescendants(subtopic, collapsedIds, branchExpansion);
    y += height + ORG_RIGHT_DESCENDANT_SIBLING_GAP;
  }
}

/*
 * 作用：
 * 右向组织结构图的侧向展开：普通主题从右侧直接展开子主题组。
 */
export function placeOrgRightSideDescendants(parent, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  const heights = subtopics.map((subtopic) =>
    orgRightSubtreeHeight(subtopic, collapsedIds, branchExpansion)
  );
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * ORG_RIGHT_DESCENDANT_SIBLING_GAP;
  let y = parentBox.y - totalHeight / 2;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const height = heights[index];

    subtopicBox.side = 'org-right';
    subtopicBox.branchExpansion = 'side';
    subtopicBox.x =
      parentBox.x + parentBox.width / 2 + ORG_RIGHT_DESCENDANT_LEVEL_GAP + subtopicBox.width / 2;
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeOrgRightDescendants(subtopic, collapsedIds, branchExpansion);
    y += height + ORG_RIGHT_DESCENDANT_SIBLING_GAP;
  }
}

/*
 * 作用：
 * 计算“右向组织结构图”中一个分支向右展开后需要占用的水平宽度。
 */
export function orgRightSubtreeWidth(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.width;

  const subtopicWidth = subtopics.reduce(
    (max, subtopic) => Math.max(max, orgRightSubtreeWidth(subtopic, collapsedIds, branchExpansion)),
    0
  );

  if (branchExpansion === 'hanging') {
    return horizontalHangingSubtreeWidth(box, subtopicWidth);
  }

  return Math.max(box.width, box.width + ORG_RIGHT_DESCENDANT_LEVEL_GAP + subtopicWidth);
}

/*
 * 作用：
 * 计算“右向组织结构图”中一个普通主题展开后需要占用的垂直高度。
 *
 * 为什么需要单独计算：
 * 右向组织结构图的一级分支仍然横向排列，但一级分支下面的普通主题应该像右向树形图一样，
 * 按每棵子树的实际高度向下展开，避免后代主题和兄弟主题重叠。
 */
export function orgRightSubtreeHeight(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.height;

  const subtopicHeight =
    subtopics.reduce(
      (sum, subtopic) => sum + orgRightSubtreeHeight(subtopic, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) * ORG_RIGHT_DESCENDANT_SIBLING_GAP;

  if (Number(topic?.level || 1) >= 3 && branchExpansion === 'side') {
    return Math.max(box.height, subtopicHeight);
  }

  return box.height + ORG_RIGHT_DESCENDANT_SIBLING_GAP + subtopicHeight;
}

/*
 * 作用：
 * 时间轴布局，覆盖轴上展开、轴下展开和上下平衡轴。
 *
 * 实现逻辑：
 * 二级主题是时间轴上的时间点，始终落在同一条水平轴线上。
 * 三级及更深主题才根据模式展开到轴上方或轴下方，并向右递进。
 */
export function layoutTimeline(
  root,
  collapsedIds,
  mode = 'timeline-down',
  branchExpansion = 'side'
) {
  const rootBox = root._layout;
  const subtopics = visibleSubtopics(root, collapsedIds);
  if (!subtopics.length) return;

  const branchSides = subtopics.map((subtopic, index) => rootSubtopicTimelineSide(index, mode));
  const axisBandHalfHeight = subtopics.reduce(
    (max, subtopic) => Math.max(max, subtopic._layout.height / 2),
    TOPIC_MIN_HEIGHT / 2
  );

  const axisY = rootBox.y;
  const axisStartX = rootBox.x + rootBox.width / 2;
  const firstPointLeftX = axisStartX + LEVEL_GAP;
  const sideCursors = {
    'timeline-top': firstPointLeftX,
    'timeline-bottom': firstPointLeftX,
  };
  let pointCursorX = firstPointLeftX;
  let axisEndX = axisStartX;

  rootBox.timelineAxisY = axisY;
  rootBox.timelineAxisMinX = axisStartX;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const branchSide = branchSides[index];
    const width = timelinePointWidth(subtopic, collapsedIds, branchExpansion);
    /*
     * 时间轴的上侧详情和下侧详情不会互相重叠，可以分别用独立游标压缩横向空间；
     * 轴上时间点本身仍使用 pointCursorX 避免同一条轴上的主题互相覆盖。
     */
    const blockLeftX = Math.max(pointCursorX, sideCursors[branchSide]);

    subtopicBox.side = 'timeline-point';
    subtopicBox.timelineBranchSide = branchSide;
    subtopicBox.x = blockLeftX + subtopicBox.width / 2;
    subtopicBox.y = axisY;
    subtopicBox.timelineAxisY = axisY;
    subtopicBox.timelineAxisBandHalfHeight = axisBandHalfHeight;

    placeTimelineDetails(subtopic, branchSide, collapsedIds, branchExpansion);
    pointCursorX = subtopicBox.x + subtopicBox.width / 2 + BRANCH_GAP;
    sideCursors[branchSide] = blockLeftX + width + BRANCH_GAP;
    axisEndX = Math.max(axisEndX, subtopicBox.x + subtopicBox.width / 2);
  }

  rootBox.timelineAxisMaxX = axisEndX;
}

/*
 * 作用：
 * 判断时间轴一级主题挂在轴线上方还是下方。
 */
export function rootSubtopicTimelineSide(index, mode) {
  if (mode === 'timeline-up') return 'timeline-top';
  if (mode === 'timeline') return index % 2 === 0 ? 'timeline-top' : 'timeline-bottom';
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
export function placeTimelineDetails(parent, branchSide, collapsedIds, branchExpansion = 'side') {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (Number(parent?.level || 1) >= 3 && branchExpansion === 'side') {
    placeTimelineSideDetails(parent, branchSide, collapsedIds, branchExpansion);
    return;
  }

  if (Number(parent?.level || 1) >= 3 && branchExpansion === 'hanging') {
    placeTimelineHangingDetails(parent, branchSide, collapsedIds, branchExpansion);
    return;
  }

  const parentBox = parent._layout;
  const heights = subtopics.map((subtopic) =>
    timelineDetailSubtreeHeight(subtopic, branchSide, collapsedIds, branchExpansion)
  );
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * timelineDetailSiblingGapForParent(parent, branchExpansion);
  const isDetailParent =
    parentBox.side === 'timeline-detail-top' || parentBox.side === 'timeline-detail-bottom';
  const axisBandHalfHeight = Number.isFinite(parentBox.timelineAxisBandHalfHeight)
    ? parentBox.timelineAxisBandHalfHeight
    : parentBox.height / 2;
  let y = isDetailParent
    ? parentBox.y - totalHeight / 2
    : branchSide === 'timeline-top'
      ? parentBox.y - axisBandHalfHeight - TIMELINE_AXIS_DETAIL_GAP - totalHeight
      : parentBox.y + axisBandHalfHeight + TIMELINE_AXIS_DETAIL_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const height = heights[index];
    const isTopBranch = branchSide === 'timeline-top';

    subtopicBox.side = isTopBranch ? 'timeline-detail-top' : 'timeline-detail-bottom';
    subtopicBox.branchExpansion = '';
    subtopicBox.timelineBranchSide = branchSide;
    /*
     * 时间轴详情树使用更大的横向推进距离。
     * 这样父主题右侧出口、竖向目录线和子主题之间会留出呼吸感，
     * 避免多级节点挤成一团。
     */
    subtopicBox.x = parentBox.x + TIMELINE_DETAIL_LEVEL_GAP + subtopicBox.width / 2;
    /*
     * 每个主题都放在自己完整子树占位块的中线位置。
     * 这样当某个详情主题继续展开子主题时，父主题右侧出口能自然对齐子主题组的总高度中线。
     */
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeTimelineDetails(subtopic, branchSide, collapsedIds, branchExpansion);
    y += height + timelineDetailSiblingGapForParent(parent, branchExpansion);
  }
}

/*
 * 作用：
 * 时间轴详情区的下挂展开。
 *
 * 关键点：
 * 时间轴上侧/下侧只决定详情树挂在主轴哪一侧；
 * 进入三级及更深的普通主题后，“下挂展开”仍然从主题下方出线并向下排列。
 */
export function placeTimelineHangingDetails(parent, branchSide, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  const isTopBranch = branchSide === 'timeline-top';
  const gap = timelineDetailSiblingGapForParent(parent, branchExpansion);
  const heights = subtopics.map((subtopic) =>
    timelineDetailSubtreeHeight(subtopic, branchSide, collapsedIds, branchExpansion)
  );
  let blockTopY = parentBox.y + parentBox.height / 2 + gap;

  parentBox.childBranchExpansion = 'hanging-horizontal';

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const height = heights[index];

    subtopicBox.side = isTopBranch ? 'timeline-detail-top' : 'timeline-detail-bottom';
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.timelineBranchSide = branchSide;
    subtopicBox.x = parentBox.x + HANGING_LEVEL_GAP + subtopicBox.width / 2;
    subtopicBox.y = verticalBlockTopicY(blockTopY, height, subtopic, branchExpansion);

    placeTimelineDetails(subtopic, branchSide, collapsedIds, branchExpansion);
    blockTopY += height + gap;
  }
}

/*
 * 作用：
 * 时间轴详情区的侧向展开：三级及更深主题从右侧直接继续展开。
 */
export function placeTimelineSideDetails(parent, branchSide, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  const heights = subtopics.map((subtopic) =>
    timelineDetailSubtreeHeight(subtopic, branchSide, collapsedIds, branchExpansion)
  );
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * timelineDetailSiblingGapForParent(parent, branchExpansion);
  let y = parentBox.y - totalHeight / 2;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const height = heights[index];
    const isTopBranch = branchSide === 'timeline-top';

    subtopicBox.side = isTopBranch ? 'timeline-detail-top' : 'timeline-detail-bottom';
    subtopicBox.branchExpansion = 'side';
    subtopicBox.timelineBranchSide = branchSide;
    subtopicBox.x =
      parentBox.x + parentBox.width / 2 + TIMELINE_DETAIL_LEVEL_GAP + subtopicBox.width / 2;
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeTimelineDetails(subtopic, branchSide, collapsedIds, branchExpansion);
    y += height + timelineDetailSiblingGapForParent(parent, branchExpansion);
  }
}

/*
 * 作用：
 * 计算某个时间点连同详情区需要占用的横向宽度。
 */
export function timelinePointWidth(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.width;

  const subtopicWidth = subtopics.reduce(
    (max, subtopic) => Math.max(max, timelinePointWidth(subtopic, collapsedIds, branchExpansion)),
    0
  );

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    return horizontalHangingSubtreeWidth(box, subtopicWidth);
  }

  return Math.max(box.width, box.width / 2 + TIMELINE_DETAIL_LEVEL_GAP + subtopicWidth);
}

/*
 * 作用：
 * 计算时间轴详情子树需要占用的垂直高度。
 */
export function timelineDetailSubtreeHeight(
  topic,
  branchSide,
  collapsedIds,
  branchExpansion = 'side'
) {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.height;

  const subtopicHeight =
    subtopics.reduce(
      (sum, subtopic) =>
        sum + timelineDetailSubtreeHeight(subtopic, branchSide, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) * timelineDetailSiblingGapForParent(topic, branchExpansion);

  if (Number(topic?.level || 1) >= 3 && branchExpansion === 'hanging') {
    return box.height + timelineDetailSiblingGapForParent(topic, branchExpansion) + subtopicHeight;
  }

  /*
   * 详情树是向右展开的：父主题和子主题组在横向上分列，垂直占位取二者较大值。
   * 如果继续使用“父主题高度 + 子主题组高度”，会把子树块算得过高，
   * 也会让父主题出口无法对齐子主题组中线。
   */
  return Math.max(box.height, subtopicHeight);
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
  const subtopics = visibleSubtopics(root, collapsedIds);
  const radius = Math.max(
    RADIAL_ROOT_RADIUS_MIN,
    root._layout.width / 2 + RADIAL_LEVEL_GAP + RADIAL_ROOT_RADIUS_EXTRA
  );
  const branchPlans = radialBranchDirectionPlans(subtopics, collapsedIds);

  branchPlans.forEach((plan) => {
    const branchRadius = radialBranchRadius(
      radius,
      plan.subtopic,
      plan.angle,
      plan.slice,
      collapsedIds
    );

    placeRadialRootBranch(root, plan.subtopic, plan.angle, branchRadius, collapsedIds);
  });

  resolveRadialRootBranchCollisions(root, subtopics, collapsedIds);
}

/*
 * 作用：
 * 给放射图一级主题分配绘制方向。
 *
 * 实现逻辑：
 * - 先计算每个一级分支的占用面积和复杂度。
 * - 再把大分支优先放到彼此相隔更远的角度槽位上。
 * - 小分支最后填入剩余方向。
 *
 * 这样会牺牲“按文档顺序绕圈”的严格顺序，但能显著降低大分支挤在一起导致的重叠。
 */
export function radialBranchDirectionPlans(subtopics, collapsedIds) {
  if (!subtopics.length) return [];

  const slotAngle = (Math.PI * 2) / subtopics.length;
  const angleSlots = radialSpreadAngleSlots(subtopics.length);
  const branchPlans = subtopics.map((subtopic, documentIndex) => {
    const stats = radialBranchStats(subtopic, collapsedIds);
    return {
      subtopic,
      documentIndex,
      stats,
      areaScore: radialBranchAreaScore(stats),
      // slice 表示该方向可用的理论扇区宽度，后续半径补偿会用它估算安全距离。
      slice: slotAngle,
    };
  });

  const largeBranchFirstPlans = [...branchPlans].sort((left, right) => {
    if (right.areaScore !== left.areaScore) return right.areaScore - left.areaScore;
    return left.documentIndex - right.documentIndex;
  });

  largeBranchFirstPlans.forEach((plan, index) => {
    plan.angle = angleSlots[index];
  });

  return branchPlans;
}

/*
 * 作用：
 * 生成一组尽量“先远后近”的角度槽位。
 *
 * 例子：
 * 如果有 8 个一级分支，分配顺序大致是上、下、右、左、右上、左下、右下、左上。
 * 最大的几个分支会先落到相距更远的位置，减少外接矩形互相压住的概率。
 */
export function radialSpreadAngleSlots(count) {
  const baseAngles = Array.from(
    { length: count },
    (_, index) => -Math.PI / 2 + (index * Math.PI * 2) / count
  );
  const orderedSlotIndexes = [];
  const used = new Set();

  const pushNearestUnusedSlot = (targetIndex) => {
    for (let step = 0; step < count; step += 1) {
      const rightIndex = (targetIndex + step) % count;
      if (!used.has(rightIndex)) {
        used.add(rightIndex);
        orderedSlotIndexes.push(rightIndex);
        return;
      }

      const leftIndex = (targetIndex - step + count) % count;
      if (!used.has(leftIndex)) {
        used.add(leftIndex);
        orderedSlotIndexes.push(leftIndex);
        return;
      }
    }
  };

  /*
   * 先把四个主方向占住，再补四个斜向。
   * 后续如果一级分支更多，再按照普通圆周顺序填剩余槽位。
   */
  const preferredFractions = [0, 0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875];
  for (const fraction of preferredFractions) {
    pushNearestUnusedSlot(Math.round(fraction * count) % count);
  }

  for (let index = 0; index < count; index += 1) {
    if (!used.has(index)) {
      used.add(index);
      orderedSlotIndexes.push(index);
    }
  }

  return orderedSlotIndexes.map((index) => baseAngles[index]);
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
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  const unit = radialUnit(angle);
  const normal = radialNormal(angle);
  const breadths = subtopics.map((subtopic) => radialSubtreeBreadth(subtopic, angle, collapsedIds));
  const totalBreadth =
    breadths.reduce((sum, breadth) => sum + breadth, 0) +
    Math.max(0, subtopics.length - 1) * RADIAL_SIBLING_GAP;
  const parentForward = radialExtent(parentBox, angle);
  let offset = -totalBreadth / 2;

  subtopics.forEach((subtopic, index) => {
    const subtopicBox = subtopic._layout;
    const breadth = breadths[index];
    const subtopicForward = radialExtent(subtopicBox, angle);
    const along = parentForward + RADIAL_LEVEL_GAP + subtopicForward;
    const cross = offset + breadth / 2;

    subtopicBox.side = radialSide(angle);
    subtopicBox.radialAngle = angle;
    subtopicBox.x = parentBox.x + unit.x * along + normal.x * cross;
    subtopicBox.y = parentBox.y + unit.y * along + normal.y * cross;

    placeRadialDescendants(subtopic, angle, collapsedIds);
    offset += breadth + RADIAL_SIBLING_GAP;
  });
}

/*
 * 作用：
 * 计算放射图中某棵子树沿射线垂直方向需要占用的宽度。
 */
export function radialSubtreeBreadth(topic, angle, collapsedIds) {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const ownBreadth = radialPerpendicularExtent(box, angle) * 2;
  if (!subtopics.length) return ownBreadth;

  const subtopicBreadth =
    subtopics.reduce(
      (sum, subtopic) => sum + radialSubtreeBreadth(subtopic, angle, collapsedIds),
      0
    ) +
    Math.max(0, subtopics.length - 1) * RADIAL_SIBLING_GAP;

  return Math.max(ownBreadth, subtopicBreadth);
}

/*
 * 作用：
 * 统计一级放射分支的复杂度，供角度动态分配使用。
 */
export function radialBranchStats(topic, collapsedIds) {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  let descendantCount = subtopics.length;
  let maxDepth = subtopics.length ? 1 : 0;

  for (const subtopic of subtopics) {
    const subtopicStats = radialBranchStats(subtopic, collapsedIds);
    descendantCount += subtopicStats.descendantCount;
    maxDepth = Math.max(maxDepth, subtopicStats.maxDepth + 1);
  }

  return {
    directSubtopicCount: subtopics.length,
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
    stat.directSubtopicCount * 0.75 +
    Math.sqrt(stat.descendantCount) * 0.55 +
    stat.maxDepth * 0.35 +
    stat.sizeScore * 0.35
  );
}

/*
 * 作用：
 * 根据分支统计信息估算这个一级分支对空间的占用。
 *
 * 说明：
 * 排方向时使用面积感更强的分数，而不是只看后代数量。
 * 这样长文本分支、深层分支和直接子主题很多的分支都会优先拿到更独立的方向。
 */
export function radialBranchAreaScore(stat) {
  return (
    radialBranchWeight(stat) +
    stat.directSubtopicCount * 1.2 +
    stat.descendantCount * 0.45 +
    stat.maxDepth * 1.1 +
    stat.sizeScore * 1.8
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
  const safeHalfAngle = Math.max(0.26, Math.min(slice * 0.48, Math.PI / 2.6));
  const requiredRadius = breadth / 2 / Math.tan(safeHalfAngle);

  return Math.max(baseRadius, Math.min(baseRadius + RADIAL_RADIUS_EXTRA_LIMIT, requiredRadius));
}

/*
 * 作用：
 * 放射图排版后的防重叠修正。
 *
 * 为什么需要二次修正：
 * 角度分配只能预估每个分支需要的扇区，真实主题是矩形，长文本、深层后代、不同方向的投影
 * 都可能让两个相邻扇区实际碰到一起。因此这里把每个一级主题的整棵可见子树当成一个整体，
 * 用矩形碰撞检测做最后一道保护，优先保证“不要重叠”。
 */
export function resolveRadialRootBranchCollisions(root, rootSubtopics, collapsedIds) {
  for (let iteration = 0; iteration < RADIAL_COLLISION_ITERATIONS; iteration += 1) {
    let moved = false;

    /*
     * 第一轮先处理中心主题和一级分支子树的碰撞。
     * 中心主题是固定锚点，所以只把碰到中心主题的分支整体向外推。
     */
    for (const subtopic of rootSubtopics) {
      const branchBounds = radialSubtreeBounds(subtopic, collapsedIds, RADIAL_COLLISION_MARGIN);
      const rootBounds = radialTopicBounds(root._layout, RADIAL_COLLISION_MARGIN);
      const push = radialCollisionPush(rootBounds, branchBounds);
      if (!push) continue;

      translateRadialSubtree(subtopic, push.dx, push.dy, collapsedIds);
      updateRadialRootBranchDirection(root, subtopic);
      moved = true;
    }

    /*
     * 第二轮处理一级分支之间的碰撞。
     * 两边各推一半，能保留整体围绕中心展开的感觉，不会让某一个分支承担全部位移。
     */
    for (let leftIndex = 0; leftIndex < rootSubtopics.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < rootSubtopics.length; rightIndex += 1) {
        const leftTopic = rootSubtopics[leftIndex];
        const rightTopic = rootSubtopics[rightIndex];
        const leftBounds = radialSubtreeBounds(leftTopic, collapsedIds, RADIAL_COLLISION_MARGIN);
        const rightBounds = radialSubtreeBounds(rightTopic, collapsedIds, RADIAL_COLLISION_MARGIN);
        const push = radialCollisionPush(leftBounds, rightBounds);
        if (!push) continue;

        translateRadialSubtree(leftTopic, -push.dx / 2, -push.dy / 2, collapsedIds);
        translateRadialSubtree(rightTopic, push.dx / 2, push.dy / 2, collapsedIds);
        updateRadialRootBranchDirection(root, leftTopic);
        updateRadialRootBranchDirection(root, rightTopic);
        moved = true;
      }
    }

    if (!moved) return;
  }
}

/*
 * 作用：
 * 计算一个放射分支整棵可见子树的外接矩形。
 */
export function radialSubtreeBounds(topic, collapsedIds, margin = 0) {
  const topics = radialVisibleSubtreeTopics(topic, collapsedIds);
  const left = Math.min(...topics.map((item) => item._layout.x - item._layout.width / 2));
  const right = Math.max(...topics.map((item) => item._layout.x + item._layout.width / 2));
  const top = Math.min(...topics.map((item) => item._layout.y - item._layout.height / 2));
  const bottom = Math.max(...topics.map((item) => item._layout.y + item._layout.height / 2));

  return {
    left: left - margin,
    right: right + margin,
    top: top - margin,
    bottom: bottom + margin,
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
}

/*
 * 作用：
 * 计算单个主题的外接矩形，主要用于中心主题这个固定碰撞体。
 */
export function radialTopicBounds(box, margin = 0) {
  return {
    left: box.x - box.width / 2 - margin,
    right: box.x + box.width / 2 + margin,
    top: box.y - box.height / 2 - margin,
    bottom: box.y + box.height / 2 + margin,
    x: box.x,
    y: box.y,
  };
}

/*
 * 作用：
 * 如果两个矩形发生重叠，计算把第二个矩形推出去所需的最小位移。
 */
export function radialCollisionPush(fixedBounds, movingBounds) {
  const overlapX =
    Math.min(fixedBounds.right, movingBounds.right) - Math.max(fixedBounds.left, movingBounds.left);
  const overlapY =
    Math.min(fixedBounds.bottom, movingBounds.bottom) - Math.max(fixedBounds.top, movingBounds.top);

  if (overlapX <= 0 || overlapY <= 0) return null;

  const signX = movingBounds.x >= fixedBounds.x ? 1 : -1;
  const signY = movingBounds.y >= fixedBounds.y ? 1 : -1;

  if (overlapX < overlapY) {
    return { dx: signX * (overlapX + 1), dy: 0 };
  }

  return { dx: 0, dy: signY * (overlapY + 1) };
}

/*
 * 作用：
 * 收集一个放射分支下所有未折叠的可见主题。
 */
export function radialVisibleSubtreeTopics(topic, collapsedIds) {
  const topics = [topic];
  if (collapsedIds.has(topic.id)) return topics;

  for (const subtopic of topic.subtopics) {
    topics.push(...radialVisibleSubtreeTopics(subtopic, collapsedIds));
  }

  return topics;
}

/*
 * 作用：
 * 整体平移一个放射分支子树。
 */
export function translateRadialSubtree(topic, dx, dy, collapsedIds) {
  topic._layout.x += dx;
  topic._layout.y += dy;
  if (collapsedIds.has(topic.id)) return;

  for (const subtopic of topic.subtopics) {
    translateRadialSubtree(subtopic, dx, dy, collapsedIds);
  }
}

/*
 * 作用：
 * 分支子树被碰撞修正整体平移后，更新一级主题相对中心主题的角度和方向。
 *
 * 注意：
 * 只更新一级主题本身。它的后代和父主题一起平移，父子相对方向没有改变，
 * 所以后代仍然保留原来的 radialAngle。
 */
export function updateRadialRootBranchDirection(root, subtopic) {
  const angle = Math.atan2(
    subtopic._layout.y - root._layout.y,
    subtopic._layout.x - root._layout.x
  );
  subtopic._layout.radialAngle = angle;
  subtopic._layout.side = radialSide(angle);
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
 * 鱼骨图布局，中心主题作为鱼头，一级大分支交替挂在主骨上下。
 *
 * 实现逻辑：
 * - fishbone-left：鱼头在左，主骨向右延伸。
 * - fishbone-right：鱼头在右，主骨向左延伸。
 * - 一级主题按照上下交替的方式挂到主骨上，形成鱼骨的大分支和斜骨线。
 * - 三级主题是鱼刺主题，挂在斜骨线中段。
 * - 三级及更深主题是鱼刺主题的后代，继续朝鱼尾方向树状展开。
 */
export function layoutFishbone(
  root,
  collapsedIds,
  mode = 'fishbone-left',
  branchExpansion = 'side'
) {
  const rootBox = root._layout;
  const subtopics = visibleSubtopics(root, collapsedIds);
  if (!subtopics.length) return;

  const direction = mode === 'fishbone-right' ? -1 : 1;
  const firstAttachX = rootBox.x + direction * (rootBox.width / 2 + LEVEL_GAP);
  const sideCursors = {
    top: firstAttachX,
    bottom: firstAttachX + direction * LEVEL_GAP * 0.45,
  };

  rootBox.fishboneDirection = direction;

  subtopics.forEach((subtopic, index) => {
    const subtopicBox = subtopic._layout;
    const sign = index % 2 === 0 ? -1 : 1;
    const sideKey = sign < 0 ? 'top' : 'bottom';
    // 大分支的子树高度决定它离主骨多远，避免上下两侧的鱼刺主题互相压住。
    const primaryBoneHeight = fishbonePrimaryBoneSubtreeHeight(
      subtopic,
      collapsedIds,
      branchExpansion
    );
    const attachX = sideCursors[sideKey];
    /*
     * 大分支斜骨使用固定倾角，避免不同分支因为自身高度不同而出现忽陡忽缓的观感。
     * 先根据子树高度算出大分支主题靠近主骨一侧边缘的纵向偏移，
     * 再用固定斜率反推水平投影，这样斜骨线角度稳定，仍然给高分支留出足够空间。
     */
    const primaryBoneEdgeOffset = Math.max(
      FISHBONE_PRIMARY_BONE_MIN_EDGE_OFFSET,
      primaryBoneHeight + SIBLING_GAP * 2.5
    );
    const primaryBoneRun = primaryBoneEdgeOffset / FISHBONE_PRIMARY_BONE_SLOPE;

    subtopicBox.side = sign < 0 ? 'fishbone-top' : 'fishbone-bottom';
    subtopicBox.fishboneSign = sign;
    subtopicBox.fishboneDirection = direction;
    // 大分支挂到主骨上的 x 坐标，渲染主骨分段时也依赖它来确定每段颜色。
    subtopicBox.fishboneMainSpineAttachX = attachX;
    subtopicBox.x = attachX + direction * primaryBoneRun;
    subtopicBox.y = rootBox.y + sign * (primaryBoneEdgeOffset + subtopicBox.height / 2);
    // 斜骨线从主骨挂点出发，终点落在大分支主题靠近主骨的一侧边框中点。
    subtopicBox.fishboneDiagonalBoneStartX = attachX;
    subtopicBox.fishboneDiagonalBoneStartY = rootBox.y;
    subtopicBox.fishboneDiagonalBoneEndX = subtopicBox.x;
    subtopicBox.fishboneDiagonalBoneEndY =
      sign < 0 ? subtopicBox.y + subtopicBox.height / 2 : subtopicBox.y - subtopicBox.height / 2;

    placeFishboneRibTopics(subtopic, sign, direction, collapsedIds, branchExpansion);
    /*
     * 同侧下一条大分支的挂点，落在上一条大分支可见子树末端垂线与主骨的交点上。
     * 这比使用“预估宽度 + 安全间距”更贴近鱼骨图语义，也避免主骨上出现过大的空白段。
     */
    sideCursors[sideKey] = fishboneVisibleSubtreeHorizontalBoundary(
      subtopic,
      direction,
      collapsedIds
    );
  });
}

/*
 * 作用：
 * 摆放鱼骨图中挂在斜骨线上的鱼刺主题。
 *
 * 实现逻辑：
 * 鱼刺主题不是按普通树从大分支主题右侧长出，而是先沿着斜骨线寻找挂点；
 * 挂点的 y 坐标由鱼刺主题子树高度决定，挂点的 x 坐标再通过斜骨线线性插值得到。
 */
export function placeFishboneRibTopics(parent, sign, direction, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  const diagonalBoneStartX = parentBox.fishboneDiagonalBoneStartX;
  const diagonalBoneStartY = parentBox.fishboneDiagonalBoneStartY;
  const diagonalBoneEndX = parentBox.fishboneDiagonalBoneEndX;
  const diagonalBoneEndY = parentBox.fishboneDiagonalBoneEndY;
  const ribTopicHeights = subtopics.map((subtopic) =>
    fishboneRibTopicSubtreeHeight(subtopic, collapsedIds, branchExpansion)
  );
  const totalRibHeight =
    ribTopicHeights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * SIBLING_GAP;
  const diagonalBoneHeight = Math.abs(diagonalBoneEndY - diagonalBoneStartY);
  const usableHeight = Math.max(1, diagonalBoneHeight - parentBox.height - SIBLING_GAP * 2);
  const contentStart = SIBLING_GAP + Math.max(0, (usableHeight - totalRibHeight) / 2);
  let offset = 0;

  subtopics.forEach((subtopic, index) => {
    const subtopicBox = subtopic._layout;
    const height = ribTopicHeights[index];
    const blockStartOnDiagonal = contentStart + offset;
    const blockEndOnDiagonal = blockStartOnDiagonal + height;
    const blockStartY = diagonalBoneEndY - sign * blockStartOnDiagonal;
    const blockEndY = diagonalBoneEndY - sign * blockEndOnDiagonal;
    const blockTopY = Math.min(blockStartY, blockEndY);
    const subtopicY = verticalBlockTopicY(blockTopY, height, subtopic, branchExpansion);
    const ratio = clamp(
      (subtopicY - diagonalBoneStartY) / (diagonalBoneEndY - diagonalBoneStartY || 1),
      0,
      1
    );
    const attachX = diagonalBoneStartX + (diagonalBoneEndX - diagonalBoneStartX) * ratio;
    const attachY = subtopicY;

    subtopicBox.side = 'fishbone-rib-topic';
    subtopicBox.fishboneSign = sign;
    subtopicBox.fishboneDirection = direction;
    // 鱼刺主题挂到斜骨线上的交点，渲染连线和折叠点都会用到。
    subtopicBox.fishboneDiagonalBoneAttachX = attachX;
    subtopicBox.fishboneDiagonalBoneAttachY = attachY;
    subtopicBox.x = attachX + direction * (LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = subtopicY;

    placeFishboneRibDescendants(subtopic, sign, direction, collapsedIds, branchExpansion);
    offset += height + SIBLING_GAP;
  });
}

/*
 * 作用：
 * 摆放鱼刺主题的后代主题。
 */
export function placeFishboneRibDescendants(
  parent,
  sign,
  direction,
  collapsedIds,
  branchExpansion = 'side'
) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (shouldUseHangingExpansion(parent, branchExpansion)) {
    placeFishboneHangingRibDescendants(parent, sign, direction, collapsedIds, branchExpansion);
    return;
  }

  const parentBox = parent._layout;
  const heights = subtopics.map((subtopic) =>
    fishboneRibTopicSubtreeHeight(subtopic, collapsedIds, branchExpansion)
  );
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * SIBLING_GAP;
  let y = parentBox.y - totalHeight / 2;

  subtopics.forEach((subtopic, index) => {
    const subtopicBox = subtopic._layout;
    const height = heights[index];

    subtopicBox.side = 'fishbone-rib-descendant';
    subtopicBox.fishboneSign = sign;
    subtopicBox.fishboneDirection = direction;
    subtopicBox.x =
      parentBox.x + direction * (parentBox.width / 2 + LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeFishboneRibDescendants(subtopic, sign, direction, collapsedIds, branchExpansion);
    y += height + SIBLING_GAP;
  });
}

/*
 * 作用：
 * 鱼刺后代的下挂展开：从鱼刺主题下方出线，再朝鱼尾方向接到子主题。
 */
export function placeFishboneHangingRibDescendants(
  parent,
  sign,
  direction,
  collapsedIds,
  branchExpansion
) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const heights = subtopics.map((subtopic) =>
    fishboneRibTopicSubtreeHeight(subtopic, collapsedIds, branchExpansion)
  );
  let y = parentBox.y + parentBox.height / 2 + HANGING_SIBLING_GAP;

  subtopics.forEach((subtopic, index) => {
    const subtopicBox = subtopic._layout;
    const height = heights[index];

    subtopicBox.side = 'fishbone-rib-descendant';
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.fishboneSign = sign;
    subtopicBox.fishboneDirection = direction;
    subtopicBox.x = parentBox.x + direction * (HANGING_LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeFishboneRibDescendants(subtopic, sign, direction, collapsedIds, branchExpansion);
    y += height + HANGING_SIBLING_GAP;
  });
}

/*
 * 作用：
 * 计算鱼骨图大分支子树需要占用的垂直高度。
 */
export function fishbonePrimaryBoneSubtreeHeight(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.height;

  const ribHeight =
    subtopics.reduce(
      (sum, subtopic) =>
        sum + fishboneRibTopicSubtreeHeight(subtopic, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) * SIBLING_GAP;

  return Math.max(box.height, ribHeight);
}

/*
 * 作用：
 * 计算鱼刺主题及其后代需要占用的垂直高度。
 */
export function fishboneRibTopicSubtreeHeight(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.height;

  const subtopicHeight =
    subtopics.reduce(
      (sum, subtopic) =>
        sum + fishboneRibTopicSubtreeHeight(subtopic, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) *
      (shouldUseHangingExpansion(topic, branchExpansion) ? HANGING_SIBLING_GAP : SIBLING_GAP);

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    return box.height + HANGING_SIBLING_GAP + subtopicHeight;
  }

  return Math.max(box.height, subtopicHeight);
}

/*
 * 作用：
 * 计算鱼骨图大分支子树向鱼尾方向延伸的宽度。
 */
export function fishbonePrimaryBoneSubtreeWidth(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.width;

  const subtopicWidth = subtopics.reduce(
    (max, subtopic) =>
      Math.max(max, fishboneRibTopicSubtreeWidth(subtopic, collapsedIds, branchExpansion)),
    0
  );

  return Math.max(box.width, LEVEL_GAP + subtopicWidth);
}

/*
 * 作用：
 * 计算鱼刺主题及其后代向鱼尾方向延伸的宽度。
 */
export function fishboneRibTopicSubtreeWidth(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.width;

  const subtopicWidth = subtopics.reduce(
    (max, subtopic) =>
      Math.max(max, fishboneRibTopicSubtreeWidth(subtopic, collapsedIds, branchExpansion)),
    0
  );

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    return Math.max(box.width, HANGING_LEVEL_GAP + subtopicWidth);
  }

  return box.width + LEVEL_GAP + subtopicWidth;
}

/*
 * 作用：
 * 计算鱼骨图某条大分支可见子树在鱼尾方向上的水平边界。
 *
 * 使用场景：
 * 同侧下一条大分支的斜骨起点，应放在上一条大分支末端垂线和主骨的交点上。
 * 这个“末端垂线”就是整棵可见子树在鱼尾方向上的最远边界。
 */
export function fishboneVisibleSubtreeHorizontalBoundary(topic, direction, collapsedIds) {
  const box = topic?._layout;
  if (!box) return 0;

  let boundary = direction > 0 ? box.x + box.width / 2 : box.x - box.width / 2;
  for (const subtopic of visibleSubtopics(topic, collapsedIds)) {
    const subtopicBoundary = fishboneVisibleSubtreeHorizontalBoundary(
      subtopic,
      direction,
      collapsedIds
    );
    boundary =
      direction > 0 ? Math.max(boundary, subtopicBoundary) : Math.min(boundary, subtopicBoundary);
  }

  return boundary;
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

  const subtopics = visibleSubtopics(root, collapsedIds);
  if (!subtopics.length) return;

  const bodyTop = headerHeight;
  const tableLeft = -tableWidth / 2;
  const columnLefts = treeTableColumnLefts(columnWidths, tableLeft);
  const subtopicHeights = subtopics.map((subtopic) =>
    treeTableSubtreeHeight(subtopic, collapsedIds)
  );
  let cursorTop = bodyTop;

  subtopics.forEach((subtopic, index) => {
    const allocatedHeight = subtopicHeights[index];
    placeTreeTableTopic(
      subtopic,
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

    for (const subtopic of visibleSubtopics(topic, collapsedIds)) {
      visit(subtopic, columnIndex + 1);
    }
  };

  for (const subtopic of visibleSubtopics(root, collapsedIds)) {
    visit(subtopic, 0);
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
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return ownHeight;

  const subtopicsHeight = subtopics.reduce(
    (sum, subtopic) => sum + treeTableSubtreeHeight(subtopic, collapsedIds),
    0
  );

  return Math.max(ownHeight, subtopicsHeight);
}

/*
 * 作用：
 * 把主题和它的子树放入树形表格。
 *
 * 变量说明：
 * allocatedHeight 是当前主题拿到的完整单元格高度，类似表格 rowspan 后的高度。
 * subtopicExtraHeight 是父单元格比子主题总高度多出来的部分；平均分给子主题，避免长文案父主题压住右侧子表格。
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
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const isLeafTopic = subtopics.length === 0;
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

  if (!subtopics.length) return;

  const subtopicBaseHeights = subtopics.map((subtopic) =>
    treeTableSubtreeHeight(subtopic, collapsedIds)
  );
  const subtopicBaseTotal = subtopicBaseHeights.reduce((sum, height) => sum + height, 0);
  const subtopicExtraHeight = Math.max(0, allocatedHeight - subtopicBaseTotal);
  const subtopicExtraHeightPerTopic = subtopicExtraHeight / subtopics.length;
  let subtopicTop = topY;

  subtopics.forEach((subtopic, index) => {
    const subtopicAllocatedHeight = subtopicBaseHeights[index] + subtopicExtraHeightPerTopic;
    placeTreeTableTopic(
      subtopic,
      columnIndex + 1,
      subtopicTop,
      subtopicAllocatedHeight,
      columnLefts,
      columnWidths,
      collapsedIds,
      { fillLeafRemainderColumns }
    );
    subtopicTop += subtopicAllocatedHeight;
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
export function visibleSubtopics(topic, collapsedIds) {
  if (collapsedIds.has(topic.id)) return [];
  return topic.subtopics;
}

/*
 * 作用：
 * 收集当前可见主题和父子连线关系，供 SVG 渲染层使用。
 */
export function collectVisible(topic, collapsedIds, topics, connectors) {
  topics.push(topic);
  for (const subtopic of visibleSubtopics(topic, collapsedIds)) {
    connectors.push({ parentTopic: topic, subtopic });
    collectVisible(subtopic, collapsedIds, topics, connectors);
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
