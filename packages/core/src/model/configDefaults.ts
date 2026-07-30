/*
 * 文件作用：
 * 集中定义所有宿主共享的产品配置枚举、数值边界和文档默认值。
 */

import { BRANCH_EXPANSIONS, CONNECTOR_STYLES } from './configDocument.js';
import { TOPIC_MAX_WIDTH } from '../layout/layoutConstants.js';
import { LAYOUT_MODES } from '../layout/layoutTree.js';
import { DEFAULT_THEME_NAME, MIND_THEME_NAMES } from './theme.js';

export const CANVAS_MIN_HEIGHT = 96;
export const CANVAS_MAX_HEIGHT = 1800;
export const FONT_SIZE_MIN = 9;
export const FONT_SIZE_MAX = 96;
export const FONT_WEIGHT_MIN = 100;
export const FONT_WEIGHT_MAX = 900;
export const FONT_LINE_HEIGHT_MIN = 12;
export const FONT_LINE_HEIGHT_MAX = 160;
export const TOPIC_MAX_WIDTH_MIN = 120;
export const TOPIC_MAX_WIDTH_MAX = 2000;

export const TOOLBAR_CORNERS = Object.freeze([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const);
export const TOOLBAR_PLACEMENTS = Object.freeze(['inside', 'outside'] as const);
export const THEME_SCHEMES = MIND_THEME_NAMES;
export const BUTTON_COLOR_MODES = Object.freeze([
  'inherit-accent',
  'subtle',
  'topic',
  'custom',
] as const);
export const TOPIC_CONTROL_VISIBILITY_MODES = Object.freeze([
  'always',
  'toggle-always',
  'hover',
] as const);
export const VIEW_MODES = Object.freeze(['map', 'source'] as const);
export const VIEW_FIT_MODES = Object.freeze(['original', 'fit'] as const);
export const FIT_VIEW_MAX_SCALE_MIN = 1;
export const FIT_VIEW_MAX_SCALE_MAX = 6;

/*
 * 所有 WebView 宿主都应提供该 CSS 变量；非 CSS 宿主可在绘制适配层映射这个语义字体令牌。
 */
export const DEFAULT_FONT_FAMILY = 'var(--font-text)';
export const TEXT_ALIGN_VALUES = Object.freeze(['auto', 'left', 'center', 'right'] as const);

export const WATERMARK_MODES = Object.freeze(['signature', 'normal'] as const);
export const WATERMARK_SIGNATURE_STYLES = Object.freeze(['corner', 'bar'] as const);
export const WATERMARK_TYPES = Object.freeze(['text', 'image'] as const);
export const WATERMARK_ARRANGEMENTS = Object.freeze(['single', 'tiled'] as const);
export const WATERMARK_IMAGE_SOURCE_TYPES = Object.freeze(['url', 'vault'] as const);
export const WATERMARK_POSITIONS = Object.freeze([
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const);
export const WATERMARK_FONT_SIZE_MIN = 8;
export const WATERMARK_FONT_SIZE_MAX = 160;
export const WATERMARK_OPACITY_MIN = 0.01;
export const WATERMARK_OPACITY_MAX = 1;
export const WATERMARK_ROTATION_MIN = -180;
export const WATERMARK_ROTATION_MAX = 180;
export const WATERMARK_SIZE_MIN = 8;
export const WATERMARK_SIZE_MAX = 2000;
export const WATERMARK_GAP_MIN = 0;
export const WATERMARK_GAP_MAX = 2000;
export const WATERMARK_OFFSET_MIN = -2000;
export const WATERMARK_OFFSET_MAX = 2000;

export const DEFAULT_MIND_CONFIG = Object.freeze({
  display: Object.freeze({
    canvasHeight: null,
    sourceHeight: null,
    viewFit: 'fit',
    fitViewNoUpscale: true,
    fitViewMaxScale: 1.5,
    saveFullConfig: false,
  }),
  structure: Object.freeze({
    layout: 'mindmap-right',
    connectorStyle: 'curve',
    branchExpansion: 'side',
    topicMaxWidth: Object.freeze({
      global: TOPIC_MAX_WIDTH,
    }),
  }),
  color: Object.freeze({
    scheme: DEFAULT_THEME_NAME,
    defaultTopicColor: '',
    buttonColorMode: 'inherit-accent',
    buttonColor: '',
    advancedStructure: Object.freeze({
      relation: '#526b8a',
      summary: '#705b8f',
      boundary: '#477970',
    }),
  }),
  font: Object.freeze({
    family: DEFAULT_FONT_FAMILY,
    size: 16,
    weight: 400,
    lineHeight: 20,
    align: 'auto',
  }),
  interaction: Object.freeze({
    toolbar: Object.freeze({
      corner: 'top-right',
      placement: 'outside',
    }),
    topicControlVisibility: 'toggle-always',
    tabIndent: true,
    wheelZoom: false,
  }),
  watermark: Object.freeze({
    enabled: false,
    mode: 'signature',
    signature: Object.freeze({
      style: 'corner',
      text: 'Made with Yonxao Mind Map',
      position: 'bottom-right',
      color: '#64748b',
      backgroundColor: 'transparent',
      fontSize: 14,
      opacity: 0.7,
      barHeight: 36,
      paddingX: 16,
      paddingY: 16,
    }),
    normal: Object.freeze({
      type: 'text',
      arrangement: 'tiled',
      position: 'center',
      text: '© Yonxao',
      imageSourceType: 'url',
      imageSource: '',
      color: '#64748b',
      fontSize: 24,
      opacity: 0.18,
      rotation: -30,
      width: 160,
      height: 80,
      gapX: 120,
      gapY: 100,
      offsetX: 0,
      offsetY: 0,
    }),
  }),
});

export const RUNTIME_LAYOUT_TYPES = LAYOUT_MODES;
export const RUNTIME_CONNECTOR_STYLES = CONNECTOR_STYLES;
export const RUNTIME_BRANCH_EXPANSIONS = BRANCH_EXPANSIONS;
