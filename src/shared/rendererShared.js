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

export { Menu, Notice, setIcon, setTooltip } from 'obsidian';

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
  MINDMAP_LAYOUT_TYPES,
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
export { findFenceBySection, replaceCodeBlockSource } from '../markdown/codeBlock.js';
export {
  cloneTopicSubtree,
  containsTopicId,
  countTopicDescendants,
  findTopicContext,
  insertSiblingTopic,
  moveTopicInTree,
  removeTopicById,
  refreshTreeLevels,
  setOptionalTopicAttribute,
} from '../model/topicTreeActions.js';
export { markYonxaoMindmapEmbedWrapper } from '../obsidian/embed.js';
export { assignIds, createMindTopic, parseMindDocument } from '../parser/parseMind.js';
export { serializeMindDocument, serializeTopic } from '../parser/serializeMind.js';
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

// ── 拖拽与交互 ──────────────────────────────────────────
// 拖拽手势的最小移动像素阈值，低于此值视为点击而非拖拽。
export const DRAG_START_THRESHOLD = 4;
// 放置指示线相对主题边框的偏移量（像素）。
export const DROP_INDICATOR_OFFSET = 8;
// 放置位置判定比例：ratio < BEFORE_THRESHOLD 判定为 before，> AFTER_THRESHOLD 判定为 after。
export const DROP_BEFORE_THRESHOLD = 0.25;
export const DROP_AFTER_THRESHOLD = 0.75;

// ── 视图适配 ────────────────────────────────────────────
// 缩放到原始大小时的最大重试次数。
export const MAX_VIEW_FIT_RETRY = 5;
// 适应视图的最小视口宽度（像素）。
export const MIN_FIT_VIEWPORT_WIDTH = 240;
// viewBox 缩放钳制最小/最大尺寸。
export const VIEWBOX_MIN_DIMENSION = 80;
export const VIEWBOX_MAX_DIMENSION = 8000;
// 适应视图重试延迟（毫秒），首次适配完成后额外调度一次修正。
export const VIEW_FIT_REFRESH_DELAY_MS = 80;
// 全屏时容器边缘与视口的间距（像素）。
export const FULLSCREEN_VIEWPORT_OFFSET = 32;
// 焦点偏移判定比例阈值，超过此值时采用偏置焦点而非居中。
export const FOCUS_RATIO_BIAS_THRESHOLD = 1.25;
// 焦点在视口中的位置比例（偏置/居中）。
export const FOCUS_RATIO_BIASED = 0.32;
export const FOCUS_RATIO_CENTER = 0.5;

// ── 滚轮缩放 ────────────────────────────────────────────
// 滚轮缩放系数：向下滚动（放大）和向上滚动（缩小）。
export const WHEEL_ZOOM_FACTOR_OUT = 1.12;
export const WHEEL_ZOOM_FACTOR_IN = 0.88;

// ── 鱼骨图 ──────────────────────────────────────────────
// 鱼骨图尾部翅膀尺寸（像素）。
export const FISHBONE_TAIL_WING_X = 18;
export const FISHBONE_TAIL_WING_Y = 10;
// 鱼骨图尾部延长系数（相对 LEVEL_GAP 的倍数）。
export const FISHBONE_TAIL_EXTEND_FACTOR = 1.7;

// ── 几何计算 ────────────────────────────────────────────
// 几何计算中的极小阈值，用于判断浮点数是否为零方向。
export const GEOMETRY_EPSILON = 0.0001;
// 连线线段截断阈值，小于该值的线段视为零长度不绘制。
export const SEGMENT_LENGTH_EPSILON = 0.001;
// 时间轴详情分支的最小横向偏移量（像素）。
export const TIMELINE_MIN_TRUNK_X = 6;

// ── 导出 ────────────────────────────────────────────────
// 导出图片画布的最大边长（像素）。
export const EXPORT_MAX_CANVAS_SIDE = 8192;
// 导出像素比的上限和下限。
export const EXPORT_MAX_DEVICE_PIXEL_RATIO = 2;
export const EXPORT_MIN_PIXEL_SCALE = 0.25;
// 导出文件名的最大字符长度。
export const EXPORT_FILENAME_MAX_LENGTH = 80;

// ── 按钮控件 ────────────────────────────────────────────
// 编辑按钮尺寸（宽度和高度）及其圆角半径。
export const EDIT_BUTTON_SIZE = 20;
export const EDIT_BUTTON_BORDER_RADIUS = 5;

// ── 连线路径 ────────────────────────────────────────────
// 曲线连线的最小弯曲量（像素），确保短距离连线仍可见弯曲。
export const CURVE_MIN_BEND = 44;
// 曲线连线的弯曲比例（相对两端点距离的系数）。
export const CURVE_BEND_RATIO = 0.46;

// ── 手动高度 ────────────────────────────────────────────
// 取不到真实视口高度时的手动高度兜底值。
export const MANUAL_HEIGHT_FALLBACK_VIEWPORT = 900;
// 手动高度计算时的视口高度倍数上限。
export const MANUAL_HEIGHT_VIEWPORT_MULTIPLIER = 1.6;

// ── 渲染器内部常量 ──────────────────────────────────────
// 容器宽度变化判定阈值（像素），小于此值的变化不被视为有效尺寸变更。
export const RESIZE_WIDTH_EPSILON = 1;
// 源码/导图视图模式记忆的过期时间（毫秒）。
export const SESSION_VIEW_MODE_EXPIRY_MS = 6000;
// 视图模式缓存 key 中 source 文本的截断长度。
export const VIEW_MODE_KEY_SOURCE_TRUNCATE_LENGTH = 80;
