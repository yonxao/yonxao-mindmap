/*
 * 文件作用：
 * 布局系统共享常量、主题测量、extent 计算和可见主题辅助。
 */

import {
  BRANCH_GAP,
  ICON_GAP,
  LEVEL_GAP,
  SIBLING_GAP,
  TOPIC_MAX_WIDTH,
  TOPIC_MIN_HEIGHT,
  TOPIC_MIN_WIDTH,
  TOPIC_PADDING_X,
  TOPIC_PADDING_Y,
} from '../constants.js';
import {
  CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS,
  normalizeMindConfig,
  resolveTopicFont,
  resolveTopicMaxWidth,
} from '../config/mindConfig.js';
import { normalizeIcon, resolveTopicIconSize } from '../icons/renderIcon.js';
import { clamp } from '../utils/math.js';
/*
 * 富文本块级格式布局工具：
 * 解析主题内容中的列表、代码块、公式和段落标记，按最大宽度换行并返回带样式片段的块级结构。
 */
import { wrapTopicRichBlocksByWidth } from '../utils/richText.js';

export {
  BRANCH_GAP,
  ICON_GAP,
  LEVEL_GAP,
  SIBLING_GAP,
  TOPIC_MAX_WIDTH,
  TOPIC_MIN_HEIGHT,
  TOPIC_MIN_WIDTH,
  TOPIC_PADDING_X,
  TOPIC_PADDING_Y,
  CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS,
  clamp,
};

export const TOPIC_CONTROL_SAFE_SIBLING_GAP = 19;
export const ORG_RIGHT_DESCENDANT_LEVEL_GAP = Math.round(LEVEL_GAP * 0.62);
export const ORG_RIGHT_DESCENDANT_SIBLING_GAP = Math.max(
  TOPIC_CONTROL_SAFE_SIBLING_GAP,
  Math.round(SIBLING_GAP * 0.56)
);

/*
 * 树形图天然有一条主干，分支之间已经由主干建立层级关系。
 * 如果继续使用普通思维导图的横向/纵向间距，主干两侧会出现大量空白。
 */
export const TREE_TRUNK_START_GAP = Math.max(22, Math.round(SIBLING_GAP * 1.25));
export const TREE_TRUNK_LEVEL_GAP = Math.max(28, Math.round(LEVEL_GAP * 0.36));
export const TREE_TRUNK_BRANCH_GAP = Math.max(12, Math.round(BRANCH_GAP * 0.42));
// 树形图双侧模式中，相邻一级主题在主干上的最小挂点距离，用来保留文档顺序感。
export const TREE_TRUNK_ORDER_GAP = Math.max(18, Math.round(SIBLING_GAP * 1.05));
export const TREE_DESCENDANT_LEVEL_GAP = Math.max(28, Math.round(LEVEL_GAP * 0.55));
export const TREE_DESCENDANT_SIBLING_GAP = Math.max(
  TOPIC_CONTROL_SAFE_SIBLING_GAP,
  Math.round(SIBLING_GAP * 0.72)
);
export const TREE_HANGING_SIBLING_GAP = Math.max(
  TOPIC_CONTROL_SAFE_SIBLING_GAP,
  Math.round(SIBLING_GAP * 0.78)
);

/*
 * 时间轴详情区不是普通的“父子左右展开”，而是挂在时间轴竖线旁的事件详情树。
 * 这里保留独立间距，但比普通导图更紧凑，让时间点本身的横向节奏更接近时间轴。
 */
export const TIMELINE_DETAIL_LEVEL_GAP = Math.max(38, Math.round(LEVEL_GAP * 0.82));
export const TIMELINE_DETAIL_SIBLING_GAP = Math.max(
  TOPIC_CONTROL_SAFE_SIBLING_GAP,
  Math.round(SIBLING_GAP * 0.82)
);
export const TIMELINE_DETAIL_HANGING_SIBLING_GAP = Math.max(
  TIMELINE_DETAIL_SIBLING_GAP,
  Math.round(SIBLING_GAP * 1.12)
);
export const TIMELINE_AXIS_DETAIL_GAP = Math.max(20, Math.round(SIBLING_GAP * 1.05));

/*
 * 放射图的阅读体验更依赖“聚合感”：主题需要围绕中心聚在一起，而不是像普通导图一样
 * 每层都拉开很长距离。这里单独定义更紧凑的放射间距，避免整张图占用过多空白。
 */
export const RADIAL_ROOT_RADIUS_MIN = 168;
export const RADIAL_ROOT_RADIUS_EXTRA = 72;
export const RADIAL_LEVEL_GAP = Math.round(LEVEL_GAP * 0.82);
export const RADIAL_SIBLING_GAP = Math.max(
  TOPIC_CONTROL_SAFE_SIBLING_GAP,
  Math.round(SIBLING_GAP * 0.9)
);
export const RADIAL_RADIUS_EXTRA_LIMIT = Math.round(LEVEL_GAP * 1.35);
export const RADIAL_COLLISION_MARGIN = 24;
export const RADIAL_COLLISION_ITERATIONS = 24;
export const HANGING_LEVEL_GAP = Math.round(LEVEL_GAP * 0.72);
export const HANGING_SIBLING_GAP = Math.max(TOPIC_CONTROL_SAFE_SIBLING_GAP, SIBLING_GAP);
/*
 * 作用：
 * 水平下挂展开时，第一子主题中心点距离父主题出口边缘的最小视觉间隙。
 */
export const HORIZONTAL_HANGING_EDGE_GAP = Math.max(24, Math.round(SIBLING_GAP * 1.35));
/*
 * 作用：
 * 竖向下挂展开时，第一子主题中心点距离父主题出口边缘的最小视觉间隙。
 */
export const VERTICAL_HANGING_EDGE_GAP = Math.max(24, Math.round(SIBLING_GAP * 1.35));
export const FISHBONE_PRIMARY_BONE_ANGLE = Math.PI * 0.32;
export const FISHBONE_PRIMARY_BONE_SLOPE = Math.tan(FISHBONE_PRIMARY_BONE_ANGLE);
export const FISHBONE_PRIMARY_BONE_MIN_EDGE_OFFSET = Math.round(TOPIC_MIN_HEIGHT * 2.4);

// 计算主题文本垂直居中的字体偏移比例，基于字体 ascent 经验值
export const TEXT_Y_CENTER_RATIO = 0.36;
// 主题可用文本区域的最小宽度，确保极短文本也能正常展示
export const MIN_USABLE_TEXT_WIDTH = 48;
// 图标占位相对于图标大小的最小比例，用于计算图标和文本之间的间隙
export const ICON_GAP_MIN_RATIO = 0.35;
// 图标和文本之间间隙的上限
export const MAX_ICON_GAP = 16;
// 下挂展开生效的起始层级（三级及更深）
export const HANGING_EXPANSION_LEVEL_THRESHOLD = 3;

/*
 * 作用：
 * 子主题展开方式只作用于 HANGING_EXPANSION_LEVEL_THRESHOLD 及更深主题继续展开子主题。
 */
export function shouldUseHangingExpansion(parent, branchExpansion) {
  return (
    branchExpansion === 'hanging' && Number(parent?.level || 1) >= HANGING_EXPANSION_LEVEL_THRESHOLD
  );
}

/*
 * 作用：
 * 在垂直堆叠的占位块中计算主题 y 坐标。
 *
 * 关键点：
 * 如果这个主题自己会继续下挂展开，它的后代会从它下方长出；
 * 因此主题必须靠近占位块顶部，而不是放在整块中线，否则后代会溢出并压住后续兄弟主题。
 */
export function verticalBlockTopicY(blockTop, blockHeight, topic, branchExpansion) {
  const box = topic._layout;
  return (
    blockTop +
    (shouldUseHangingExpansion(topic, branchExpansion) ? box.height / 2 : blockHeight / 2)
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
export function horizontalHangingSubtreeWidth(box, subtopicWidth, firstSubtopicBox = null) {
  const startOffset = horizontalHangingStartOffset(box, firstSubtopicBox);
  return Math.max(box.width, box.width / 2 + startOffset + subtopicWidth);
}

/*
 * 作用：
 * 计算水平下挂子主题组相对父主题中心线的起始偏移。
 *
 * 关键点：
 * 右向树形图、组织结构图、时间轴、鱼骨图等结构中，父主题可能比第一个子主题宽很多。
 * 如果仍然只按固定 HANGING_LEVEL_GAP 偏移，第一子主题中心点会落进父主题出口边缘内侧，
 * 导致折线从父主题自身穿过。
 */
export function horizontalHangingStartOffset(box, firstSubtopicBox) {
  const firstSubtopicHalfWidth = Number.isFinite(firstSubtopicBox?.width)
    ? firstSubtopicBox.width / 2
    : 0;
  return Math.max(
    HANGING_LEVEL_GAP,
    box.width / 2 + HORIZONTAL_HANGING_EDGE_GAP - firstSubtopicHalfWidth
  );
}

/*
 * 作用：
 * 计算竖向下挂子主题组相对父主题中心线的起始偏移。
 *
 * 关键点：
 * 竖向布局的下挂子主题统一从父主题右侧展开。
 * 当父主题很宽时，如果仍然只按固定 HANGING_LEVEL_GAP 偏移，第一个子主题中心点可能落进
 * 父主题右边缘内侧，导致父子连线穿过父主题自身。
 */
export function verticalHangingStartOffset(box, firstSubtopicExtent, hangingDir) {
  const firstInnerExtent =
    hangingDir > 0 ? firstSubtopicExtent?.left || 0 : firstSubtopicExtent?.right || 0;
  return Math.max(HANGING_LEVEL_GAP, box.width / 2 + VERTICAL_HANGING_EDGE_GAP - firstInnerExtent);
}

/*
 * 作用：
 * 计算水平思维导图子树相对当前主题中心点的上下占位。
 *
 * 为什么不用单一 height：
 * 下挂展开的主题会把后代放在自己下方，导致“主题中心点上方”和“主题中心点下方”
 * 需要的空间不对称。只用总高度再强行居中，会让只有一个三级主题时父子连线变成折线。
 */
export function horizontalSubtreeExtent(topic, side, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const ownAbove = box.height / 2;
  const ownBelow = box.height / 2;

  if (!subtopics.length) {
    return { above: ownAbove, below: ownBelow, height: box.height };
  }

  const subtopicExtents = subtopics.map((subtopic) =>
    horizontalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    const subtopicHeight = verticalExtentGroupHeight(subtopicExtents, HANGING_SIBLING_GAP);
    return normalizeVerticalExtent({
      above: ownAbove,
      below: ownBelow + HANGING_SIBLING_GAP + subtopicHeight,
    });
  }

  const subtopicHeight = verticalExtentGroupHeight(subtopicExtents, SIBLING_GAP);
  const subtopicCenterOffset = directSubtopicGroupCenterOffset(subtopicExtents, SIBLING_GAP);
  return normalizeVerticalExtent({
    above: Math.max(ownAbove, subtopicCenterOffset),
    below: Math.max(ownBelow, subtopicHeight - subtopicCenterOffset),
  });
}

/*
 * 作用：
 * 把一组上下不对称的子树占位合并成整体高度。
 */
export function verticalExtentGroupHeight(extents, gap) {
  if (!extents.length) return 0;
  return (
    extents.reduce((sum, extent) => sum + extent.above + extent.below, 0) +
    Math.max(0, extents.length - 1) * gap
  );
}

/*
 * 作用：
 * 统一补齐 extent.height，避免调用处重复计算。
 */
export function normalizeVerticalExtent(extent) {
  return {
    above: extent.above,
    below: extent.below,
    height: extent.above + extent.below,
  };
}

/*
 * 作用：
 * 计算一组直接子主题连接点的中心线偏移。
 *
 * 参数说明：
 * - centerKey 是单个子树占位中“直接主题中心点”到占位起点的距离。
 * - sizeKey 是单个子树在当前轴向上的完整占位。
 *
 * 这样父主题可以对齐“直接子主题连线组”，而不是被深层后代的外包矩形拉偏。
 */
export function directExtentGroupCenterOffset(extents, gap, centerKey, sizeKey) {
  if (!extents.length) return 0;
  if (extents.length === 1) return extents[0][centerKey];

  const firstCenter = extents[0][centerKey];
  const lastBeforeStart =
    extents.slice(0, -1).reduce((sum, extent) => sum + extent[sizeKey], 0) +
    Math.max(0, extents.length - 1) * gap;
  const lastCenter = lastBeforeStart + extents[extents.length - 1][centerKey];
  return (firstCenter + lastCenter) / 2;
}

/*
 * 作用：
 * 计算一组直接子主题的中心线相对这组占位顶部的偏移。
 *
 * 关键点：
 * 父主题应该和“直接子主题连线组”垂直居中；直接子主题各自的后代只负责扩大避让占位，
 * 不参与这条父子连线的中心判断。
 */
export function directSubtopicGroupCenterOffset(extents, gap) {
  return directExtentGroupCenterOffset(extents, gap, 'above', 'height');
}

/*
 * 作用：
 * 计算竖向思维导图子树相对当前主题中心点的左右占位。
 *
 * 说明：
 * 这是 horizontalSubtreeExtent 的转置版本。竖向布局中，下挂展开会把后代放到主题侧方，
 * 因此子树左右占位是不对称的，不能只用一个总宽度来居中。
 */
export function verticalSubtreeExtent(topic, side, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const ownLeft = box.width / 2;
  const ownRight = box.width / 2;

  if (!subtopics.length) {
    return { left: ownLeft, right: ownRight, width: box.width };
  }

  const subtopicExtents = subtopics.map((subtopic) =>
    verticalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    const subtopicWidth = horizontalExtentGroupWidth(subtopicExtents, HANGING_SIBLING_GAP);
    const dir = verticalHangingDirection();
    const startOffset = verticalHangingStartOffset(box, subtopicExtents[0], dir);
    return normalizeHorizontalExtent({
      left: dir < 0 ? Math.max(ownLeft, startOffset + subtopicWidth) : ownLeft,
      right: dir > 0 ? Math.max(ownRight, startOffset + subtopicWidth) : ownRight,
    });
  }

  const subtopicWidth = horizontalExtentGroupWidth(subtopicExtents, SIBLING_GAP);
  const subtopicCenterOffset = directSubtopicGroupCenterXOffset(subtopicExtents, SIBLING_GAP);
  return normalizeHorizontalExtent({
    left: Math.max(ownLeft, subtopicCenterOffset),
    right: Math.max(ownRight, subtopicWidth - subtopicCenterOffset),
  });
}

/*
 * 作用：
 * 把一组左右不对称的子树占位合并成整体宽度。
 */
export function horizontalExtentGroupWidth(extents, gap) {
  if (!extents.length) return 0;
  return (
    extents.reduce((sum, extent) => sum + extent.left + extent.right, 0) +
    Math.max(0, extents.length - 1) * gap
  );
}

/*
 * 作用：
 * 统一补齐 extent.width，避免调用处重复计算。
 */
export function normalizeHorizontalExtent(extent) {
  return {
    left: extent.left,
    right: extent.right,
    width: extent.left + extent.right,
  };
}

/*
 * 作用：
 * 计算一组直接子主题的中心线相对这组占位左侧的偏移。
 */
export function directSubtopicGroupCenterXOffset(extents, gap) {
  return directExtentGroupCenterOffset(extents, gap, 'left', 'width');
}

/*
 * 作用：
 * 决定竖向布局下挂子主题向左还是向右展开。
 *
 * 规则：
 * 上向、下向和垂直双向思维导图的下挂内容都向右展开，保持阅读方向一致。
 */
export function verticalHangingDirection() {
  return 1;
}

/*
 * 作用：
 * 时间轴详情区在下挂展开时需要更保守的同级间距。
 *
 * 原因：
 * 时间轴详情主题会沿同一侧竖向排列；下挂子主题再向下展开时，
 * 如果仍使用普通详情间距，视觉上很容易贴到下一条详情分支。
 */
export function timelineDetailSiblingGapForParent(parent, branchExpansion) {
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
  const maxWidth = resolveTopicMaxWidth(topic, normalizedConfig) || TOPIC_MAX_WIDTH;
  const iconSize = icon ? resolveTopicIconSize(font) : 0;
  const iconGap = icon
    ? Math.round(clamp(iconSize * ICON_GAP_MIN_RATIO, ICON_GAP, MAX_ICON_GAP))
    : 0;
  const iconWidth = icon ? iconSize + iconGap : 0;
  const usableTextWidth = Math.max(
    MIN_USABLE_TEXT_WIDTH,
    maxWidth - TOPIC_PADDING_X * 2 - iconWidth
  );
  /*
   * richBlocks 保存列表、公式、代码块等块级格式；richLines/lines 保留扁平结果，
   * 让树形表格、导出和旧渲染兜底逻辑仍能读取主题的纯文本行。
   */
  const richContent = wrapTopicRichBlocksByWidth(topic.text || 'Untitled', usableTextWidth, font);
  const richLines = richContent.richLines;
  const lines = richContent.lines;
  const textWidth = Math.ceil(richContent.width);
  const measuredWidth = textWidth + TOPIC_PADDING_X * 2 + iconWidth;
  const width = clamp(measuredWidth, TOPIC_MIN_WIDTH, Math.max(maxWidth, measuredWidth));
  const contentHeight = richContent.height;
  const height = Math.max(TOPIC_MIN_HEIGHT, contentHeight + TOPIC_PADDING_Y * 2);

  return {
    width,
    height,
    lines,
    richLines,
    richBlocks: richContent.blocks,
    contentHeight,
    icon,
    iconSize,
    font,
    textAlign: font.align || 'auto',
    textX: TOPIC_PADDING_X + iconWidth,
    textY: (height - (lines.length - 1) * font.lineHeight) / 2 + font.size * TEXT_Y_CENTER_RATIO,
    textTop: (height - contentHeight) / 2,
    side: 'right',
    x: 0,
    y: 0,
  };
}

/*
 * 作用：
 * 根据折叠状态返回当前主题实际可见的子主题列表。
 */
export function visibleSubtopics(topic, collapsedIds) {
  if (collapsedIds.has(topic.id)) return [];
  return topic.subtopics;
}
