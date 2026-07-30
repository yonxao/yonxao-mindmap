/*
 * 插件配置 UI 元数据。产品默认值、枚举和安全范围由公共核心维护。
 */

import {
  FISHBONE_LAYOUT_MODES,
  FONT_LEVEL_KEYS as CORE_FONT_LEVEL_KEYS,
  MINDMAP_LAYOUT_MODES,
  ORG_LAYOUT_MODES,
  RADIAL_LAYOUT_MODES,
  TIMELINE_LAYOUT_MODES,
  TREE_LAYOUT_MODES,
  TREE_TABLE_LAYOUT_MODES,
} from '@yonxao/mindmap-core';

export {
  BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS,
  BRANCH_EXPANSIONS,
  BUTTON_COLOR_MODES,
  CANVAS_MAX_HEIGHT,
  CANVAS_MIN_HEIGHT,
  CONNECTOR_STYLES,
  CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_MIND_CONFIG,
  FIT_VIEW_MAX_SCALE_MAX,
  FIT_VIEW_MAX_SCALE_MIN,
  FONT_LEVEL_FIELD_KEYS,
  FONT_LEVEL_KEYS,
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  RUNTIME_LAYOUT_TYPES as LAYOUT_TYPES,
  TEXT_ALIGN_VALUES,
  THEME_SCHEMES,
  TOOLBAR_CORNERS,
  TOOLBAR_PLACEMENTS,
  TOPIC_CONTROL_VISIBILITY_MODES,
  TOPIC_MAX_WIDTH_MAX,
  TOPIC_MAX_WIDTH_MIN,
  VIEW_FIT_MODES,
  VIEW_MODES,
  WATERMARK_ARRANGEMENTS,
  WATERMARK_FONT_SIZE_MAX,
  WATERMARK_FONT_SIZE_MIN,
  WATERMARK_GAP_MAX,
  WATERMARK_GAP_MIN,
  WATERMARK_IMAGE_SOURCE_TYPES,
  WATERMARK_MODES,
  WATERMARK_NORMAL_CONFIG_KEYS,
  WATERMARK_OFFSET_MAX,
  WATERMARK_OFFSET_MIN,
  WATERMARK_OPACITY_MAX,
  WATERMARK_OPACITY_MIN,
  WATERMARK_POSITIONS,
  WATERMARK_ROTATION_MAX,
  WATERMARK_ROTATION_MIN,
  WATERMARK_SIGNATURE_CONFIG_KEYS,
  WATERMARK_SIGNATURE_STYLES,
  WATERMARK_SIZE_MAX,
  WATERMARK_SIZE_MIN,
  WATERMARK_TYPES,
} from '@yonxao/mindmap-core';

export const MINDMAP_LAYOUT_TYPES = MINDMAP_LAYOUT_MODES;
export const TREE_LAYOUT_TYPES = TREE_LAYOUT_MODES;
export const ORG_LAYOUT_TYPES = ORG_LAYOUT_MODES;
export const TIMELINE_LAYOUT_TYPES = TIMELINE_LAYOUT_MODES;
export const RADIAL_LAYOUT_TYPES = RADIAL_LAYOUT_MODES;
export const FISHBONE_LAYOUT_TYPES = FISHBONE_LAYOUT_MODES;
export const TREE_TABLE_LAYOUT_TYPES = TREE_TABLE_LAYOUT_MODES;

export const LAYOUT_OPTION_GROUPS = Object.freeze([
  Object.freeze({ group: 'mindmap', options: MINDMAP_LAYOUT_TYPES }),
  Object.freeze({ group: 'tree', options: TREE_LAYOUT_TYPES }),
  Object.freeze({ group: 'org', options: ORG_LAYOUT_TYPES }),
  Object.freeze({ group: 'timeline', options: TIMELINE_LAYOUT_TYPES }),
  Object.freeze({ group: 'radial', options: RADIAL_LAYOUT_TYPES }),
  Object.freeze({ group: 'fishbone', options: FISHBONE_LAYOUT_TYPES }),
  Object.freeze({ group: 'treeTable', options: TREE_TABLE_LAYOUT_TYPES }),
]);

export const TOPIC_MAX_WIDTH_LEVEL_KEYS = CORE_FONT_LEVEL_KEYS;
export const CUSTOM_FONT_VALUE = '__custom_font__';
export const DEFAULT_BUTTON_COLOR = '#3b82f6';
export const BUTTON_COLOR_PRESETS = Object.freeze([
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  DEFAULT_BUTTON_COLOR,
  '#8b5cf6',
  '#ec4899',
  '#64748b',
]);

export const FONT_FAMILY_GROUPS = Object.freeze([
  {
    group: 'font.group.inherit',
    options: Object.freeze([
      ['', 'font.inherit'],
      [CUSTOM_FONT_VALUE, 'font.custom'],
    ]),
  },
  {
    group: 'font.group.obsidian',
    options: Object.freeze([
      ['var(--font-interface)', 'font.obsidian.interface'],
      ['var(--font-text)', 'font.obsidian.text'],
      ['var(--font-monospace)', 'font.obsidian.monospace'],
    ]),
  },
  {
    group: 'font.group.system',
    options: Object.freeze([
      ['system-ui, sans-serif', 'font.system.sans'],
      ['ui-serif, serif', 'font.system.serif'],
      ['ui-monospace, monospace', 'font.system.monospace'],
    ]),
  },
  {
    group: 'font.group.chinese',
    options: Object.freeze([
      [
        "'Microsoft YaHei', 'PingFang SC', 'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif",
        'font.chinese.sans',
      ],
      [
        "'SimSun', 'Songti SC', 'STSong', 'Source Han Serif SC', 'Noto Serif CJK SC', serif",
        'font.chinese.serif',
      ],
      ["'KaiTi', 'Kaiti SC', 'STKaiti', 'LXGW WenKai', serif", 'font.chinese.kaiti'],
      ["'FangSong', 'STFangsong', serif", 'font.chinese.fangsong'],
      ["'Microsoft YaHei', '微软雅黑', sans-serif", 'font.chinese.microsoftYaHei'],
      ["'PingFang SC', '苹方', sans-serif", 'font.chinese.pingFang'],
      ["'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif", 'font.chinese.sourceHanSans'],
      ["'Source Han Serif SC', 'Noto Serif CJK SC', serif", 'font.chinese.sourceHanSerif'],
      ["'LXGW WenKai GB', 'LXGW WenKai', serif", 'font.chinese.lxgwWenkai'],
    ]),
  },
  {
    group: 'font.group.monospace',
    options: Object.freeze([
      [
        "'Sarasa Mono SC', 'Noto Sans Mono CJK SC', 'Source Han Mono SC', monospace",
        'font.monospace.cjkStack',
      ],
      ["'Sarasa Mono SC', 'Sarasa Fixed SC', monospace", 'font.monospace.sarasa'],
      ["'LXGW WenKai Mono', 'LXGW WenKai Mono GB', monospace", 'font.monospace.lxgwwenkai'],
      ["'JetBrains Mono', monospace", 'font.monospace.jetbrains'],
      ["'Cascadia Mono', monospace", 'font.monospace.cascadia'],
    ]),
  },
]);

export const FONT_FAMILY_OPTIONS = Object.freeze(
  FONT_FAMILY_GROUPS.flatMap((group) => group.options)
);
