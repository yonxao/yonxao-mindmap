/*
 * 文件作用：
 * 将原始配置清洗成渲染器稳定读取的运行时配置。
 */

import { normalizeMindThemeName } from '../theme/mindThemes.js';
import { clamp } from '../utils/math.js';
import { isPlainObject } from './configAccessors.js';
import { canonicalizeMindConfig } from './configCanonicalize.js';
import {
  BRANCH_EXPANSIONS,
  BUTTON_COLOR_MODES,
  CANVAS_MAX_HEIGHT,
  CANVAS_MIN_HEIGHT,
  CONNECTOR_STYLES,
  DEFAULT_MIND_CONFIG,
  FIT_VIEW_MAX_SCALE_MAX,
  FIT_VIEW_MAX_SCALE_MIN,
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  LAYOUT_TYPES,
  TOOLBAR_CORNERS,
  TOOLBAR_PLACEMENTS,
  TOPIC_CONTROL_VISIBILITY_MODES,
  TOPIC_MAX_WIDTH_MAX,
  TOPIC_MAX_WIDTH_MIN,
  VIEW_FIT_MODES,
  VIEW_MODES,
} from './defaultMindConfig.js';

export function normalizeMindConfig(rawConfig) {
  if (isRuntimeMindConfig(rawConfig)) {
    return normalizeRuntimeMindConfig(rawConfig);
  }

  const raw = canonicalizeMindConfig(rawConfig);
  const display = isPlainObject(raw.display) ? raw.display : {};
  const structure = isPlainObject(raw.structure) ? raw.structure : {};
  const color = isPlainObject(raw.color) ? raw.color : {};
  const font = isPlainObject(raw.font) ? raw.font : {};
  const interaction = isPlainObject(raw.interaction) ? raw.interaction : {};
  const toolbar = isPlainObject(interaction.toolbar) ? interaction.toolbar : {};

  return {
    canvas: {
      height: normalizeOptionalNumber(display.canvasHeight, CANVAS_MIN_HEIGHT, CANVAS_MAX_HEIGHT),
    },
    toolbar: {
      corner: normalizeToolbarCorner(toolbar.corner) || DEFAULT_MIND_CONFIG.toolbar.corner,
      placement:
        normalizeToolbarPlacement(toolbar.placement) || DEFAULT_MIND_CONFIG.toolbar.placement,
    },
    interaction: {
      wheelZoom:
        typeof interaction.wheelZoom === 'boolean'
          ? interaction.wheelZoom
          : DEFAULT_MIND_CONFIG.interaction.wheelZoom,
    },
    view: {
      mode: DEFAULT_MIND_CONFIG.view.mode,
      fit: normalizeViewFit(display.viewFit) || DEFAULT_MIND_CONFIG.view.fit,
      fitNoUpscale:
        typeof display.fitViewNoUpscale === 'boolean'
          ? display.fitViewNoUpscale
          : DEFAULT_MIND_CONFIG.view.fitNoUpscale,
      fitMaxScale:
        normalizeOptionalNumber(
          display.fitViewMaxScale,
          FIT_VIEW_MAX_SCALE_MIN,
          FIT_VIEW_MAX_SCALE_MAX
        ) || DEFAULT_MIND_CONFIG.view.fitMaxScale,
      saveFullConfig:
        typeof display.saveFullConfig === 'boolean'
          ? display.saveFullConfig
          : DEFAULT_MIND_CONFIG.view.saveFullConfig,
    },
    theme: normalizeMindThemeName(color.scheme),
    layout: normalizeLayoutType(structure.layout) || DEFAULT_MIND_CONFIG.layout,
    connector: {
      style:
        normalizeConnectorStyle(structure.connectorStyle) || DEFAULT_MIND_CONFIG.connector.style,
    },
    branch: {
      expansion:
        normalizeBranchExpansion(structure.branchExpansion) || DEFAULT_MIND_CONFIG.branch.expansion,
    },
    font: normalizeFontConfig(font),
    topic: normalizeTopicConfig(color, structure),
    button: normalizeButtonConfig(color, interaction),
    source: {
      enableTabIndent:
        typeof interaction.tabIndent === 'boolean'
          ? interaction.tabIndent
          : DEFAULT_MIND_CONFIG.source.enableTabIndent,
      height: normalizeOptionalNumber(display.sourceHeight, CANVAS_MIN_HEIGHT, CANVAS_MAX_HEIGHT),
    },
  };
}

/*
 * 作用：
 * 判断传入对象是否已经是渲染器使用的运行时规范结构。
 *
 * 关键点：
 * 这不是旧 YAML 配置兼容；layoutTree()/resolveTopicFont() 会把 this.config 再传回来，
 * normalizeMindConfig() 必须保持幂等，否则布局类型会被清空回默认值。
 */
function isRuntimeMindConfig(config) {
  return (
    isPlainObject(config) && (typeof config.layout === 'string' || typeof config.theme === 'string')
  );
}

/*
 * 作用：
 * 清洗已经规范化过的运行时配置，保证二次 normalize 不改变语义。
 */
function normalizeRuntimeMindConfig(config) {
  const canvas = isPlainObject(config.canvas) ? config.canvas : {};
  const toolbar = isPlainObject(config.toolbar) ? config.toolbar : {};
  const interaction = isPlainObject(config.interaction) ? config.interaction : {};
  const view = isPlainObject(config.view) ? config.view : {};
  const connector = isPlainObject(config.connector) ? config.connector : {};
  const branch = isPlainObject(config.branch) ? config.branch : {};
  const source = isPlainObject(config.source) ? config.source : {};

  return {
    canvas: {
      height: normalizeOptionalNumber(canvas.height, CANVAS_MIN_HEIGHT, CANVAS_MAX_HEIGHT),
    },
    toolbar: {
      corner: normalizeToolbarCorner(toolbar.corner) || DEFAULT_MIND_CONFIG.toolbar.corner,
      placement:
        normalizeToolbarPlacement(toolbar.placement) || DEFAULT_MIND_CONFIG.toolbar.placement,
    },
    interaction: {
      wheelZoom:
        typeof interaction.wheelZoom === 'boolean'
          ? interaction.wheelZoom
          : DEFAULT_MIND_CONFIG.interaction.wheelZoom,
    },
    view: {
      ...view,
      mode: normalizeViewMode(view.mode) || DEFAULT_MIND_CONFIG.view.mode,
      fit: normalizeViewFit(view.fit) || DEFAULT_MIND_CONFIG.view.fit,
      fitNoUpscale:
        typeof view.fitNoUpscale === 'boolean'
          ? view.fitNoUpscale
          : DEFAULT_MIND_CONFIG.view.fitNoUpscale,
      fitMaxScale:
        normalizeOptionalNumber(view.fitMaxScale, FIT_VIEW_MAX_SCALE_MIN, FIT_VIEW_MAX_SCALE_MAX) ||
        DEFAULT_MIND_CONFIG.view.fitMaxScale,
      saveFullConfig:
        typeof view.saveFullConfig === 'boolean'
          ? view.saveFullConfig
          : DEFAULT_MIND_CONFIG.view.saveFullConfig,
    },
    theme: normalizeMindThemeName(config.theme),
    layout: normalizeLayoutType(config.layout) || DEFAULT_MIND_CONFIG.layout,
    connector: {
      style: normalizeConnectorStyle(connector.style) || DEFAULT_MIND_CONFIG.connector.style,
    },
    branch: {
      expansion: normalizeBranchExpansion(branch.expansion) || DEFAULT_MIND_CONFIG.branch.expansion,
    },
    font: normalizeFontConfig(config.font),
    topic: normalizeRuntimeTopicConfig(config.topic),
    button: normalizeRuntimeButtonConfig(config.button),
    source: {
      enableTabIndent:
        typeof source.enableTabIndent === 'boolean'
          ? source.enableTabIndent
          : DEFAULT_MIND_CONFIG.source.enableTabIndent,
      height: normalizeOptionalNumber(source.height, CANVAS_MIN_HEIGHT, CANVAS_MAX_HEIGHT),
    },
  };
}

/*
 * 作用：
 * 清洗运行时 topic 配置；这个结构来自 normalizeTopicConfig() 的输出，不是 YAML 字段。
 */
function normalizeRuntimeTopicConfig(rawTopic) {
  const topic = isPlainObject(rawTopic) ? rawTopic : {};
  const levels = isPlainObject(topic.levels) ? topic.levels : {};
  const normalizedLevels = {};

  for (const level of ['1', '2', '3']) {
    const levelConfig = isPlainObject(levels[level]) ? levels[level] : {};
    const maxWidth = normalizeOptionalNumber(
      levelConfig.maxWidth,
      TOPIC_MAX_WIDTH_MIN,
      TOPIC_MAX_WIDTH_MAX
    );
    if (maxWidth) normalizedLevels[level] = { maxWidth };
  }

  return {
    defaultColor: normalizeText(topic.defaultColor),
    maxWidth:
      normalizeOptionalNumber(topic.maxWidth, TOPIC_MAX_WIDTH_MIN, TOPIC_MAX_WIDTH_MAX) ||
      DEFAULT_MIND_CONFIG.topic.maxWidth,
    levels: normalizedLevels,
  };
}

export function normalizeTopicConfig(rawTheme, rawLayout) {
  const color = isPlainObject(rawTheme) ? rawTheme : {};
  const structure = isPlainObject(rawLayout) ? rawLayout : {};
  const topicMaxWidth = isPlainObject(structure.topicMaxWidth) ? structure.topicMaxWidth : {};
  const normalizedLevels = {};

  for (const level of ['1', '2', '3']) {
    const maxWidth = normalizeOptionalNumber(
      topicMaxWidth[`level${level}`],
      TOPIC_MAX_WIDTH_MIN,
      TOPIC_MAX_WIDTH_MAX
    );
    if (maxWidth) normalizedLevels[level] = { maxWidth };
  }

  return {
    defaultColor: normalizeText(color.defaultTopicColor),
    maxWidth:
      normalizeOptionalNumber(topicMaxWidth.global, TOPIC_MAX_WIDTH_MIN, TOPIC_MAX_WIDTH_MAX) ||
      DEFAULT_MIND_CONFIG.topic.maxWidth,
    levels: normalizedLevels,
  };
}

/*
 * 作用：
 * 解析 YAML 配置区中的按钮配色配置。
 *
 * 输入来源：
 * - color.buttonColorMode：配色模式，可选 inherit-accent/subtle/topic/custom
 * - color.buttonColor：自定义颜色值，仅在 buttonColorMode 为 custom 时使用
 *
 * 输出结构：
 * - colorMode：规范化的配色模式，默认 inherit-accent
 * - color：自定义颜色字符串，可能为空
 */
export function normalizeButtonConfig(rawTheme, rawBasic = {}) {
  const color = isPlainObject(rawTheme) ? rawTheme : {};
  const interaction = isPlainObject(rawBasic) ? rawBasic : {};
  const colorMode = normalizeText(color.buttonColorMode).toLowerCase();
  return {
    colorMode: BUTTON_COLOR_MODES.includes(colorMode)
      ? colorMode
      : DEFAULT_MIND_CONFIG.button.colorMode,
    color: normalizeText(color.buttonColor),
    topicControlVisibility:
      normalizeTopicControlVisibility(interaction.topicControlVisibility) ||
      DEFAULT_MIND_CONFIG.button.topicControlVisibility,
  };
}

/*
 * 作用：
 * 清洗运行时按钮配置，保证二次 normalize 不改变语义。
 *
 * 关键点：
 * normalizeMindConfig() 会把 this.config 再传回来，必须保持幂等。
 */
export function normalizeRuntimeButtonConfig(rawButton) {
  const button = isPlainObject(rawButton) ? rawButton : {};
  const colorMode = normalizeText(button.colorMode).toLowerCase();
  return {
    colorMode: BUTTON_COLOR_MODES.includes(colorMode)
      ? colorMode
      : DEFAULT_MIND_CONFIG.button.colorMode,
    color: normalizeText(button.color),
    topicControlVisibility:
      normalizeTopicControlVisibility(button.topicControlVisibility) ||
      DEFAULT_MIND_CONFIG.button.topicControlVisibility,
  };
}

/*
 * 作用：
 * 解析 font 配置，并额外清洗 levels 下的按层级配置。
 */
export function normalizeFontConfig(rawFont) {
  const font = isPlainObject(rawFont) ? rawFont : {};
  const normalizedLevels = {};

  for (const level of ['1', '2', '3']) {
    const levelKey = `level${level}`;
    if (!isPlainObject(font[levelKey])) continue;
    normalizedLevels[level] = normalizePartialFont(font[levelKey]);
  }

  return {
    ...font,
    family: normalizeText(font.family) || DEFAULT_MIND_CONFIG.font.family,
    size:
      normalizeOptionalNumber(font.size, FONT_SIZE_MIN, FONT_SIZE_MAX) ||
      DEFAULT_MIND_CONFIG.font.size,
    weight:
      normalizeOptionalNumber(font.weight, FONT_WEIGHT_MIN, FONT_WEIGHT_MAX) ||
      DEFAULT_MIND_CONFIG.font.weight,
    lineHeight:
      normalizeOptionalNumber(font.lineHeight, FONT_LINE_HEIGHT_MIN, FONT_LINE_HEIGHT_MAX) ||
      DEFAULT_MIND_CONFIG.font.lineHeight,
    levels: normalizedLevels,
  };
}

/*
 * 作用：
 * 规范化某一层级或某个主题覆盖用的字体片段。
 */
export function normalizePartialFont(rawFont) {
  const font = isPlainObject(rawFont) ? rawFont : {};
  return {
    ...font,
    family: normalizeText(font.family),
    size: normalizeOptionalNumber(font.size, FONT_SIZE_MIN, FONT_SIZE_MAX),
    weight: normalizeOptionalNumber(font.weight, FONT_WEIGHT_MIN, FONT_WEIGHT_MAX),
    lineHeight: normalizeOptionalNumber(
      font.lineHeight,
      FONT_LINE_HEIGHT_MIN,
      FONT_LINE_HEIGHT_MAX
    ),
  };
}

/*
 * 作用：
 * 计算某个主题最终使用的字体。
 *
 * 优先级：
 * 主题属性 > font.level1/level2/level3 > font 全局配置 > 默认值。
 */
export function resolveTopicFont(topic, config) {
  const safeConfig = normalizeMindConfig(config);
  const levelKey = String(topic.level || 1);
  const levelFont = safeConfig.font.levels[levelKey] || {};
  const attributes = topic.attributes || {};

  return {
    family: normalizeText(attributes.fontFamily) || levelFont.family || safeConfig.font.family,
    size:
      normalizeOptionalNumber(attributes.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX) ||
      levelFont.size ||
      safeConfig.font.size,
    weight:
      normalizeOptionalNumber(attributes.fontWeight, FONT_WEIGHT_MIN, FONT_WEIGHT_MAX) ||
      levelFont.weight ||
      safeConfig.font.weight,
    lineHeight:
      normalizeOptionalNumber(attributes.lineHeight, FONT_LINE_HEIGHT_MIN, FONT_LINE_HEIGHT_MAX) ||
      levelFont.lineHeight ||
      safeConfig.font.lineHeight,
  };
}

/*
 * 作用：
 * 计算单个主题最终使用的最大宽度。
 *
 * 优先级：
 * 主题属性 maxWidth > topic.levels[层级].maxWidth > topic.maxWidth 全局/配置区配置 > 默认值。
 */
export function resolveTopicMaxWidth(topic, config) {
  const safeConfig = normalizeMindConfig(config);
  const levelKey = String(topic?.level || 1);
  const levelTopic = safeConfig.topic.levels[levelKey] || {};
  return (
    normalizeOptionalNumber(
      topic?.attributes?.maxWidth,
      TOPIC_MAX_WIDTH_MIN,
      TOPIC_MAX_WIDTH_MAX
    ) ||
    levelTopic.maxWidth ||
    safeConfig.topic.maxWidth ||
    DEFAULT_MIND_CONFIG.topic.maxWidth
  );
}

export function normalizeText(value) {
  if (value && typeof value === 'object') return '';
  return String(value || '').trim();
}

/*
 * 作用：
 * 读取可选数字，并限制在安全范围内。
 */
export function normalizeOptionalNumber(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return clamp(number, min, max);
}

/*
 * 作用：
 * 规范化布局类型。
 *
 * 关键点：
 * layout 是配置区里的标量值，例如 layout: mindmap-left。
 * 这里不接收旧的嵌套布局配置，也不接收 right/left 这类短名，
 * 避免未发布阶段留下两套配置结构。
 */
export function normalizeLayoutType(value) {
  const text = normalizeText(value).toLowerCase();
  if (LAYOUT_TYPES.includes(text)) return text;
  return '';
}

/*
 * 作用：
 * 规范化连线线型。
 */
export function normalizeConnectorStyle(value) {
  const text = normalizeText(value).toLowerCase();
  return CONNECTOR_STYLES.includes(text) ? text : '';
}

/*
 * 作用：
 * 规范化普通主题的子主题展开方式。
 */
export function normalizeBranchExpansion(value) {
  const text = normalizeText(value).toLowerCase();
  return BRANCH_EXPANSIONS.includes(text) ? text : '';
}

/*
 * 作用：
 * 规范化主题按钮显示方式。
 */
export function normalizeTopicControlVisibility(value) {
  const text = normalizeText(value).toLowerCase();
  return TOPIC_CONTROL_VISIBILITY_MODES.includes(text) ? text : '';
}

/*
 * 作用：
 * 规范化工具栏吸附角落。
 */
export function normalizeToolbarCorner(value) {
  const text = normalizeText(value).toLowerCase();
  return TOOLBAR_CORNERS.includes(text) ? text : '';
}

/*
 * 作用：
 * 规范化工具栏相对幕布边框的位置。
 */
export function normalizeToolbarPlacement(value) {
  const text = normalizeText(value).toLowerCase();
  return TOOLBAR_PLACEMENTS.includes(text) ? text : '';
}

/*
 * 作用：
 * 规范化视图模式，只允许 map/source。
 */
export function normalizeViewMode(value) {
  const text = normalizeText(value).toLowerCase();
  return VIEW_MODES.includes(text) ? text : '';
}

/*
 * 作用：
 * 规范化打开导图时的视图适配方式。
 */
export function normalizeViewFit(value) {
  const text = normalizeText(value).toLowerCase();
  return VIEW_FIT_MODES.includes(text) ? text : '';
}
