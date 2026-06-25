/*
 * 文件作用：
 * 汇总 renderer 和 UI 模块共享的常量和工具函数。
 *
 * 实现逻辑：
 * 本文件只做稳定转发和少量跨模块常量定义，避免 renderer、UI、model 之间互相深层引用。
 *
 * 调用链：
 * renderer/*、ui/*、model/* -> shared/rendererShared.js -> config/layout/parser/utils 等基础模块。
 */

import { BUTTON_COLOR_PRESETS, DEFAULT_BUTTON_COLOR } from '../config/mindConfig.js';

export { Menu, Notice, setIcon } from 'obsidian';

export {
  CODE_BLOCK_NAME,
  VIEWBOX_MARGIN_X,
  VIEWBOX_MARGIN_Y,
  CANVAS_MIN_HEIGHT,
  CANVAS_MAX_HEIGHT,
  TOPIC_MIN_HEIGHT,
  TOPIC_PADDING_X,
  LEVEL_GAP,
} from '../constants.js';

export {
  canonicalizeMindConfig,
  BUTTON_COLOR_PRESETS,
  CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS,
  CUSTOM_FONT_VALUE,
  DEFAULT_BUTTON_COLOR,
  DEFAULT_MIND_CONFIG,
  deleteMindConfigPath,
  FONT_LEVEL_FIELD_KEYS,
  FONT_LEVEL_KEYS,
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  isPlainObject,
  TOPIC_MAX_WIDTH_LEVEL_KEYS,
  TOPIC_MAX_WIDTH_MAX,
  TOPIC_MAX_WIDTH_MIN,
  TOOLBAR_CORNERS,
  TOOLBAR_PLACEMENTS,
  hasMeaningfulConfig,
  mergeMindConfigObjects,
  mergeMindConfigSources,
  normalizeMindConfig,
  pruneInactiveMindConfig,
  resolveTopicFont,
  resolveTopicMaxWidth,
  serializeMindSource,
  setMindConfigPath,
} from '../config/mindConfig.js';
export { ICON_PATHS } from '../icons/iconPaths.js';
export { normalizeIcon, renderIcon } from '../icons/renderIcon.js';
export { layoutTree } from '../layout/layoutTree.js';
export { replaceCodeBlockSource } from '../markdown/codeBlock.js';
export {
  containsTopicId,
  countTopicDescendants,
  insertSiblingTopic,
  moveTopicInTree,
  removeTopicById,
  setOptionalTopicAttribute,
} from '../model/topicTreeActions.js';
export { markYonxaoMindmapEmbedWrapper } from '../obsidian/embed.js';
export { assignIds, createMindTopic, parseMindDocument } from '../parser/parseMind.js';
export { serializeMindDocument } from '../parser/serializeMind.js';
export { applyTopicLevelKey } from '../source/topicLevelKeys.js';
export { themeConnectorOpacity, themeTopicFillAlpha } from '../theme/mindThemes.js';
export { ConfigModal } from '../ui/ConfigModal.js';
export {
  getLocalizedFontFamilyGroups,
  isValidFontFamilyInput,
  isPresetFontValue,
  normalizeFontFamilyInput,
} from '../ui/fontOptions.js';
export { connectorColor, normalizeColor, topicColor, transparentColor } from '../utils/color.js';
export { createLabeledField } from '../utils/dom.js';
export { clamp } from '../utils/math.js';
export { svg } from '../utils/svg.js';
export { normalizeTopicTextForStorage } from '../utils/text.js';

// 主题编辑面板颜色快捷选项；复用配置面板的预设，不限制用户手写任意合法颜色。
export const TOPIC_EDITOR_COLOR_SWATCHES = BUTTON_COLOR_PRESETS;
export const TOPIC_EDITOR_DEFAULT_COLOR = DEFAULT_BUTTON_COLOR;

// 保存文档配置时可与默认配置比较并裁剪的路径集合，用于保持 yxmm 配置区简洁。
export const DOCUMENT_CONFIG_DEFAULT_PRUNE_PATHS = Object.freeze([
  ['display', 'canvasHeight'],
  ['display', 'sourceHeight'],
  ['display', 'viewFit'],
  ['display', 'fitViewNoUpscale'],
  ['display', 'fitViewMaxScale'],
  ['structure', 'layout'],
  ['structure', 'connectorStyle'],
  ['structure', 'branchExpansion'],
  ['structure', 'topicMaxWidth', 'global'],
  ['color', 'scheme'],
  ['color', 'defaultTopicColor'],
  ['color', 'buttonColorMode'],
  ['color', 'buttonColor'],
  ['interaction', 'tabIndent'],
  ['interaction', 'toolbar', 'corner'],
  ['interaction', 'toolbar', 'placement'],
  ['interaction', 'topicControlVisibility'],
  ['interaction', 'wheelZoom'],
  ['font', 'family'],
  ['font', 'size'],
  ['font', 'weight'],
  ['font', 'lineHeight'],
]);

// 折叠/展开按钮半径，参与按钮碰撞避让计算。
export const TOPIC_TOGGLE_BUTTON_RADIUS = 8;
// 新增兄弟主题按钮半径，参与同级主题之间的安全间距计算。
export const TOPIC_SIBLING_BUTTON_RADIUS = 8;
// 新增子主题按钮半径，和折叠按钮互斥显示但共享出口点位。
export const TOPIC_SUBTOPIC_BUTTON_RADIUS = 8;
// 多个主题控件发生局部冲突时保留的最小可见间隙。
export const TOPIC_CONTROL_AVOID_GAP = 3;
// 两个相邻按钮中心之间的避让偏移，等于两个按钮半径加最小可见间隙。
export const TOPIC_CONTROL_AVOID_OFFSET =
  TOPIC_TOGGLE_BUTTON_RADIUS + TOPIC_SIBLING_BUTTON_RADIUS + TOPIC_CONTROL_AVOID_GAP;

// 普通连接线默认描边宽度，导出和渲染路径都复用这一视觉基准。
export const CONNECTOR_STROKE_WIDTH = 2.2;
// 圆头线帽需要额外延伸半个描边宽度，避免视觉上比几何端点略短。
export const CONNECTOR_ROUND_CAP_EXTENSION = CONNECTOR_STROKE_WIDTH / 2;
// 默认连接线颜色 CSS 变量，实际值由主题 CSS 注入。
export const DEFAULT_CONNECTOR_STROKE = 'var(--yonxao-mindmap-default-connector)';
// 默认主题按钮颜色 CSS 变量，实际值由主题 CSS 或 Obsidian accent 决定。
export const DEFAULT_TOPIC_BUTTON_COLOR = 'var(--yonxao-mindmap-default-button-color)';
// 判断横纵轴对齐时使用的小阈值，避免浮点误差造成路径分支抖动。
export const CONNECTOR_AXIS_EPSILON = 0.5;

// 自动高度上限，避免超大导图把 Obsidian 页面撑得过长。
export const AUTO_CANVAS_MAX_HEIGHT = 800;
// 取不到真实视口高度时的兜底值，用于自动高度估算。
export const AUTO_CANVAS_FALLBACK_VIEWPORT_HEIGHT = 800;
// 自动高度下限，保证小导图仍有足够操作空间。
export const AUTO_CANVAS_MIN_HEIGHT = 220;
// 自动高度相对视口高度的比例，平衡完整展示和页面可滚动性。
export const AUTO_CANVAS_VIEWPORT_HEIGHT_RATIO = 0.75;
