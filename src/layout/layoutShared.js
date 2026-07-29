/*
 * 文件作用：
 * 插件主题测量适配器，以及公共布局常量和纯盒模型函数的兼容出口。
 */

import {
  ICON_GAP,
  TEXT_Y_CENTER_RATIO,
  TOPIC_MAX_WIDTH,
  TOPIC_MIN_HEIGHT,
  TOPIC_MIN_WIDTH,
  TOPIC_PADDING_X,
  TOPIC_PADDING_Y,
} from '@yonxao/mindmap-core';
import {
  TOPIC_MAX_WIDTH_MAX,
  CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS,
  normalizeMindConfig,
  resolveTopicFont,
  resolveTopicMaxWidth,
} from '../config/mindConfig.js';
import { normalizeIcon, resolveTopicIconSize } from '../icons/renderIcon.js';
import { clamp } from '../utils/math.js';
import {
  topicRichTextPreferredContentWidth,
  wrapTopicRichBlocksByWidth,
} from '../utils/richText.js';

export {
  BRANCH_GAP,
  FISHBONE_PRIMARY_BONE_ANGLE,
  FISHBONE_PRIMARY_BONE_MIN_EDGE_OFFSET,
  FISHBONE_PRIMARY_BONE_SLOPE,
  HANGING_EXPANSION_LEVEL_THRESHOLD,
  HANGING_LEVEL_GAP,
  HANGING_SIBLING_GAP,
  HORIZONTAL_HANGING_EDGE_GAP,
  ICON_GAP,
  LEVEL_GAP,
  ORG_RIGHT_DESCENDANT_LEVEL_GAP,
  ORG_RIGHT_DESCENDANT_SIBLING_GAP,
  RADIAL_COLLISION_ITERATIONS,
  RADIAL_COLLISION_MARGIN,
  RADIAL_LEVEL_GAP,
  RADIAL_RADIUS_EXTRA_LIMIT,
  RADIAL_ROOT_RADIUS_EXTRA,
  RADIAL_ROOT_RADIUS_MIN,
  RADIAL_SIBLING_GAP,
  SIBLING_GAP,
  TEXT_Y_CENTER_RATIO,
  TIMELINE_AXIS_DETAIL_GAP,
  TIMELINE_DETAIL_HANGING_SIBLING_GAP,
  TIMELINE_DETAIL_LEVEL_GAP,
  TIMELINE_DETAIL_SIBLING_GAP,
  TOPIC_CONTROL_SAFE_SIBLING_GAP,
  TOPIC_MAX_WIDTH,
  TOPIC_MIN_HEIGHT,
  TOPIC_MIN_WIDTH,
  TOPIC_PADDING_X,
  TOPIC_PADDING_Y,
  TREE_DESCENDANT_LEVEL_GAP,
  TREE_DESCENDANT_SIBLING_GAP,
  TREE_HANGING_SIBLING_GAP,
  TREE_TRUNK_BRANCH_GAP,
  TREE_TRUNK_LEVEL_GAP,
  TREE_TRUNK_ORDER_GAP,
  TREE_TRUNK_START_GAP,
  VERTICAL_HANGING_EDGE_GAP,
  directExtentGroupCenterOffset,
  directSubtopicGroupCenterOffset,
  directSubtopicGroupCenterXOffset,
  horizontalExtentGroupWidth,
  horizontalHangingStartOffset,
  horizontalHangingSubtreeWidth,
  horizontalSubtreeExtent,
  normalizeHorizontalExtent,
  normalizeVerticalExtent,
  shouldUseHangingExpansion,
  timelineDetailSiblingGapForParent,
  verticalBlockTopicY,
  verticalExtentGroupHeight,
  verticalHangingDirection,
  verticalHangingStartOffset,
  verticalSubtreeExtent,
  visibleSubtopics,
} from '@yonxao/mindmap-core';

export { CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS, clamp };

// 以下常量只服务插件富文本和图标测量，不属于纯布局算法。
export const MIN_USABLE_TEXT_WIDTH = 48;
export const ICON_GAP_MIN_RATIO = 0.35;
export const MAX_ICON_GAP = 16;
export const TOPIC_ADORNMENT_BUTTON_SIZE = 18;
export const TOPIC_ADORNMENT_BUTTON_GAP = 4;
export const TOPIC_ADORNMENT_LANE_GAP = 6;

export function prepareTopic(topic, config, options = {}) {
  topic._layout = measureTopic(topic, config, options);
  for (const subtopic of topic.subtopics) {
    prepareTopic(subtopic, config, options);
  }
}

/*
 * 富文本、图标和字体解析属于宿主适配；输出统一的数值盒模型交给公共布局核心。
 */
export function measureTopic(topic, config, options = {}) {
  const normalizedConfig = normalizeMindConfig(config);
  const font = resolveTopicFont(topic, normalizedConfig);
  const icon = normalizeIcon(topic.attributes.icon);
  const maxWidth = resolveTopicMaxWidth(topic, normalizedConfig) || TOPIC_MAX_WIDTH;
  const preferredContentWidth = topicRichTextPreferredContentWidth(topic.text || 'Untitled');
  const iconSize = icon ? resolveTopicIconSize(font) : 0;
  const iconGap = icon
    ? Math.round(clamp(iconSize * ICON_GAP_MIN_RATIO, ICON_GAP, MAX_ICON_GAP))
    : 0;
  const iconWidth = icon ? iconSize + iconGap : 0;
  const defaultUsableTextWidth = maxWidth - TOPIC_PADDING_X * 2 - iconWidth;
  const maxUsableTextWidth = TOPIC_MAX_WIDTH_MAX - TOPIC_PADDING_X * 2 - iconWidth;
  const usableTextWidth = Math.max(
    MIN_USABLE_TEXT_WIDTH,
    Math.min(maxUsableTextWidth, Math.max(defaultUsableTextWidth, preferredContentWidth))
  );
  let richContent = wrapTopicRichBlocksByWidth(
    topic.text || 'Untitled',
    usableTextWidth,
    font,
    options.richText || {}
  );
  const adornmentCount = Number(richContent.adornmentCount) || 0;
  const adornmentLaneWidth = topicAdornmentLaneWidth(adornmentCount);
  if (adornmentLaneWidth) {
    richContent = wrapTopicRichBlocksByWidth(
      topic.text || 'Untitled',
      Math.max(MIN_USABLE_TEXT_WIDTH, usableTextWidth - adornmentLaneWidth),
      font,
      options.richText || {}
    );
  }
  const richLines = richContent.richLines;
  const lines = richContent.lines;
  const textWidth = Math.ceil(richContent.width);
  const measuredWidth = textWidth + TOPIC_PADDING_X * 2 + iconWidth + adornmentLaneWidth;
  const width = clamp(measuredWidth, TOPIC_MIN_WIDTH, Math.max(maxWidth, measuredWidth));
  const contentHeight = richContent.height;
  const height = Math.max(TOPIC_MIN_HEIGHT, contentHeight + TOPIC_PADDING_Y * 2);

  return {
    width,
    height,
    lines,
    richLines,
    richBlocks: richContent.blocks,
    adornments: richContent.adornments || [],
    adornmentCount,
    adornmentLaneWidth,
    contentHeight,
    icon,
    iconSize,
    font,
    textAlign: font.align || 'auto',
    textX: TOPIC_PADDING_X + iconWidth,
    textRight: width - TOPIC_PADDING_X - adornmentLaneWidth,
    textY: (height - (lines.length - 1) * font.lineHeight) / 2 + font.size * TEXT_Y_CENTER_RATIO,
    textTop: (height - contentHeight) / 2,
    side: 'right',
    x: 0,
    y: 0,
  };
}

function topicAdornmentLaneWidth(count) {
  const safeCount = Math.max(0, Number(count) || 0);
  if (!safeCount) return 0;
  return (
    TOPIC_ADORNMENT_LANE_GAP +
    safeCount * TOPIC_ADORNMENT_BUTTON_SIZE +
    Math.max(0, safeCount - 1) * TOPIC_ADORNMENT_BUTTON_GAP
  );
}
