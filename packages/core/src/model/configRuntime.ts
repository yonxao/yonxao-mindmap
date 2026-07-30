/*
 * 文件作用：
 * 将文档配置或已规范化配置清洗成各宿主可直接消费的稳定运行时配置。
 */

import { canonicalizeMindConfig } from './configDocument.js';
import {
  BUTTON_COLOR_MODES,
  CANVAS_MAX_HEIGHT,
  CANVAS_MIN_HEIGHT,
  DEFAULT_MIND_CONFIG,
  FIT_VIEW_MAX_SCALE_MAX,
  FIT_VIEW_MAX_SCALE_MIN,
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  RUNTIME_BRANCH_EXPANSIONS,
  RUNTIME_CONNECTOR_STYLES,
  RUNTIME_LAYOUT_TYPES,
  TEXT_ALIGN_VALUES,
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
  WATERMARK_OFFSET_MAX,
  WATERMARK_OFFSET_MIN,
  WATERMARK_OPACITY_MAX,
  WATERMARK_OPACITY_MIN,
  WATERMARK_POSITIONS,
  WATERMARK_ROTATION_MAX,
  WATERMARK_ROTATION_MIN,
  WATERMARK_SIGNATURE_STYLES,
  WATERMARK_SIZE_MAX,
  WATERMARK_SIZE_MIN,
  WATERMARK_TYPES,
} from './configDefaults.js';
import { isPlainObject, type RawMindConfig } from '../parser/simpleYaml.js';
import { normalizeMindThemeName, type MindThemeName } from './theme.js';

const LEVEL_SUFFIXES = ['1', '2', '3'] as const;

export interface RuntimePartialFont extends RawMindConfig {
  family: string;
  size: number | null;
  weight: number | null;
  lineHeight: number | null;
}

export interface RuntimeFontConfig extends RawMindConfig {
  family: string;
  size: number;
  weight: number;
  lineHeight: number;
  align: string;
  levels: Record<string, RuntimePartialFont>;
}

export interface RuntimeTopicConfig {
  defaultColor: string;
  maxWidth: number;
  levels: Record<string, { maxWidth: number }>;
}

export interface RuntimeButtonConfig {
  colorMode: string;
  color: string;
  topicControlVisibility: string;
}

export interface RuntimeWatermarkConfig {
  enabled: boolean;
  mode: string;
  signature: {
    style: string;
    text: string;
    position: string;
    color: string;
    backgroundColor: string;
    fontSize: number;
    opacity: number;
    barHeight: number;
    paddingX: number;
    paddingY: number;
  };
  normal: {
    type: string;
    arrangement: string;
    position: string;
    text: string;
    imageSourceType: string;
    imageSource: string;
    color: string;
    fontSize: number;
    opacity: number;
    rotation: number;
    width: number;
    height: number;
    gapX: number;
    gapY: number;
    offsetX: number;
    offsetY: number;
  };
}

export interface RuntimeMindConfig {
  canvas: { height: number | null };
  toolbar: { corner: string; placement: string };
  interaction: { wheelZoom: boolean };
  view: RawMindConfig & {
    mode: string;
    fit: string;
    fitNoUpscale: boolean;
    fitMaxScale: number;
    saveFullConfig: boolean;
  };
  theme: MindThemeName;
  layout: string;
  connector: { style: string };
  branch: { expansion: string };
  font: RuntimeFontConfig;
  topic: RuntimeTopicConfig;
  button: RuntimeButtonConfig;
  advancedStructureColor: {
    relation: string;
    summary: string;
    boundary: string;
  };
  source: { enableTabIndent: boolean; height: number | null };
  watermark: RuntimeWatermarkConfig;
}

export interface RuntimeTopicLike {
  level?: unknown;
  attributes?: RawMindConfig;
}

export function normalizeMindConfig(rawConfig: unknown): RuntimeMindConfig {
  if (isRuntimeMindConfig(rawConfig)) return normalizeRuntimeMindConfig(rawConfig);

  const raw = canonicalizeMindConfig(rawConfig);
  const display = configObject(raw.display);
  const structure = configObject(raw.structure);
  const color = configObject(raw.color);
  const font = configObject(raw.font);
  const interaction = configObject(raw.interaction);
  const toolbar = configObject(interaction.toolbar);

  return {
    canvas: {
      height: normalizeOptionalNumber(display.canvasHeight, CANVAS_MIN_HEIGHT, CANVAS_MAX_HEIGHT),
    },
    toolbar: {
      corner:
        normalizeToolbarCorner(toolbar.corner) || DEFAULT_MIND_CONFIG.interaction.toolbar.corner,
      placement:
        normalizeToolbarPlacement(toolbar.placement) ||
        DEFAULT_MIND_CONFIG.interaction.toolbar.placement,
    },
    interaction: {
      wheelZoom:
        typeof interaction.wheelZoom === 'boolean'
          ? interaction.wheelZoom
          : DEFAULT_MIND_CONFIG.interaction.wheelZoom,
    },
    view: {
      mode: 'map',
      fit: normalizeViewFit(display.viewFit) || DEFAULT_MIND_CONFIG.display.viewFit,
      fitNoUpscale:
        typeof display.fitViewNoUpscale === 'boolean'
          ? display.fitViewNoUpscale
          : DEFAULT_MIND_CONFIG.display.fitViewNoUpscale,
      fitMaxScale:
        normalizeOptionalNumber(
          display.fitViewMaxScale,
          FIT_VIEW_MAX_SCALE_MIN,
          FIT_VIEW_MAX_SCALE_MAX
        ) || DEFAULT_MIND_CONFIG.display.fitViewMaxScale,
      saveFullConfig:
        typeof display.saveFullConfig === 'boolean'
          ? display.saveFullConfig
          : DEFAULT_MIND_CONFIG.display.saveFullConfig,
    },
    theme: normalizeMindThemeName(color.scheme),
    layout: normalizeLayoutType(structure.layout) || DEFAULT_MIND_CONFIG.structure.layout,
    connector: {
      style:
        normalizeConnectorStyle(structure.connectorStyle) ||
        DEFAULT_MIND_CONFIG.structure.connectorStyle,
    },
    branch: {
      expansion:
        normalizeBranchExpansion(structure.branchExpansion) ||
        DEFAULT_MIND_CONFIG.structure.branchExpansion,
    },
    font: normalizeFontConfig(font),
    topic: normalizeTopicConfig(color, structure),
    button: normalizeButtonConfig(color, interaction),
    advancedStructureColor: normalizeAdvancedStructureColorConfig(color.advancedStructure),
    source: {
      enableTabIndent:
        typeof interaction.tabIndent === 'boolean'
          ? interaction.tabIndent
          : DEFAULT_MIND_CONFIG.interaction.tabIndent,
      height: normalizeOptionalNumber(display.sourceHeight, CANVAS_MIN_HEIGHT, CANVAS_MAX_HEIGHT),
    },
    watermark: normalizeWatermarkConfig(raw.watermark),
  };
}

function isRuntimeMindConfig(config: unknown): config is RawMindConfig {
  return (
    isPlainObject(config) && (typeof config.layout === 'string' || typeof config.theme === 'string')
  );
}

function normalizeRuntimeMindConfig(config: RawMindConfig): RuntimeMindConfig {
  const canvas = configObject(config.canvas);
  const toolbar = configObject(config.toolbar);
  const interaction = configObject(config.interaction);
  const view = configObject(config.view);
  const connector = configObject(config.connector);
  const branch = configObject(config.branch);
  const source = configObject(config.source);

  return {
    canvas: {
      height: normalizeOptionalNumber(canvas.height, CANVAS_MIN_HEIGHT, CANVAS_MAX_HEIGHT),
    },
    toolbar: {
      corner:
        normalizeToolbarCorner(toolbar.corner) || DEFAULT_MIND_CONFIG.interaction.toolbar.corner,
      placement:
        normalizeToolbarPlacement(toolbar.placement) ||
        DEFAULT_MIND_CONFIG.interaction.toolbar.placement,
    },
    interaction: {
      wheelZoom:
        typeof interaction.wheelZoom === 'boolean'
          ? interaction.wheelZoom
          : DEFAULT_MIND_CONFIG.interaction.wheelZoom,
    },
    view: {
      ...view,
      mode: normalizeViewMode(view.mode) || 'map',
      fit: normalizeViewFit(view.fit) || DEFAULT_MIND_CONFIG.display.viewFit,
      fitNoUpscale:
        typeof view.fitNoUpscale === 'boolean'
          ? view.fitNoUpscale
          : DEFAULT_MIND_CONFIG.display.fitViewNoUpscale,
      fitMaxScale:
        normalizeOptionalNumber(view.fitMaxScale, FIT_VIEW_MAX_SCALE_MIN, FIT_VIEW_MAX_SCALE_MAX) ||
        DEFAULT_MIND_CONFIG.display.fitViewMaxScale,
      saveFullConfig:
        typeof view.saveFullConfig === 'boolean'
          ? view.saveFullConfig
          : DEFAULT_MIND_CONFIG.display.saveFullConfig,
    },
    theme: normalizeMindThemeName(config.theme),
    layout: normalizeLayoutType(config.layout) || DEFAULT_MIND_CONFIG.structure.layout,
    connector: {
      style:
        normalizeConnectorStyle(connector.style) || DEFAULT_MIND_CONFIG.structure.connectorStyle,
    },
    branch: {
      expansion:
        normalizeBranchExpansion(branch.expansion) || DEFAULT_MIND_CONFIG.structure.branchExpansion,
    },
    font: normalizeFontConfig(config.font),
    topic: normalizeRuntimeTopicConfig(config.topic),
    button: normalizeRuntimeButtonConfig(config.button),
    advancedStructureColor: normalizeAdvancedStructureColorConfig(config.advancedStructureColor),
    source: {
      enableTabIndent:
        typeof source.enableTabIndent === 'boolean'
          ? source.enableTabIndent
          : DEFAULT_MIND_CONFIG.interaction.tabIndent,
      height: normalizeOptionalNumber(source.height, CANVAS_MIN_HEIGHT, CANVAS_MAX_HEIGHT),
    },
    watermark: normalizeWatermarkConfig(config.watermark),
  };
}

function normalizeWatermarkConfig(rawConfig: unknown): RuntimeWatermarkConfig {
  const raw = configObject(rawConfig);
  const signature = configObject(raw.signature);
  const normal = configObject(raw.normal);
  const defaults = DEFAULT_MIND_CONFIG.watermark;
  const legacyPadding = normalizeOptionalNumber(
    signature.padding,
    WATERMARK_GAP_MIN,
    WATERMARK_GAP_MAX
  );
  const enumValue = (value: unknown, values: readonly string[], fallback: string): string =>
    values.includes(String(value || '')) ? String(value) : fallback;
  const text = (value: unknown, fallback: string): string => normalizeText(value) || fallback;

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : defaults.enabled,
    mode: enumValue(raw.mode, WATERMARK_MODES, defaults.mode),
    signature: {
      style: enumValue(signature.style, WATERMARK_SIGNATURE_STYLES, defaults.signature.style),
      text: text(signature.text, defaults.signature.text),
      position: enumValue(signature.position, WATERMARK_POSITIONS, defaults.signature.position),
      color: text(signature.color, defaults.signature.color),
      backgroundColor: text(signature.backgroundColor, defaults.signature.backgroundColor),
      fontSize:
        normalizeOptionalNumber(
          signature.fontSize,
          WATERMARK_FONT_SIZE_MIN,
          WATERMARK_FONT_SIZE_MAX
        ) || defaults.signature.fontSize,
      opacity:
        normalizeOptionalNumber(signature.opacity, WATERMARK_OPACITY_MIN, WATERMARK_OPACITY_MAX) ||
        defaults.signature.opacity,
      barHeight:
        normalizeOptionalNumber(signature.barHeight, WATERMARK_SIZE_MIN, WATERMARK_SIZE_MAX) ||
        defaults.signature.barHeight,
      paddingX:
        normalizeOptionalNumber(signature.paddingX, WATERMARK_GAP_MIN, WATERMARK_GAP_MAX) ??
        legacyPadding ??
        defaults.signature.paddingX,
      paddingY:
        normalizeOptionalNumber(signature.paddingY, WATERMARK_GAP_MIN, WATERMARK_GAP_MAX) ??
        legacyPadding ??
        defaults.signature.paddingY,
    },
    normal: {
      type: enumValue(normal.type, WATERMARK_TYPES, defaults.normal.type),
      arrangement: enumValue(
        normal.arrangement,
        WATERMARK_ARRANGEMENTS,
        defaults.normal.arrangement
      ),
      position: enumValue(normal.position, WATERMARK_POSITIONS, defaults.normal.position),
      text: text(normal.text, defaults.normal.text),
      imageSourceType: enumValue(
        normal.imageSourceType,
        WATERMARK_IMAGE_SOURCE_TYPES,
        defaults.normal.imageSourceType
      ),
      imageSource: normalizeText(normal.imageSource),
      color: text(normal.color, defaults.normal.color),
      fontSize:
        normalizeOptionalNumber(
          normal.fontSize,
          WATERMARK_FONT_SIZE_MIN,
          WATERMARK_FONT_SIZE_MAX
        ) || defaults.normal.fontSize,
      opacity:
        normalizeOptionalNumber(normal.opacity, WATERMARK_OPACITY_MIN, WATERMARK_OPACITY_MAX) ||
        defaults.normal.opacity,
      rotation:
        normalizeOptionalNumber(normal.rotation, WATERMARK_ROTATION_MIN, WATERMARK_ROTATION_MAX) ??
        defaults.normal.rotation,
      width:
        normalizeOptionalNumber(normal.width, WATERMARK_SIZE_MIN, WATERMARK_SIZE_MAX) ||
        defaults.normal.width,
      height:
        normalizeOptionalNumber(normal.height, WATERMARK_SIZE_MIN, WATERMARK_SIZE_MAX) ||
        defaults.normal.height,
      gapX:
        normalizeOptionalNumber(normal.gapX, WATERMARK_GAP_MIN, WATERMARK_GAP_MAX) ??
        defaults.normal.gapX,
      gapY:
        normalizeOptionalNumber(normal.gapY, WATERMARK_GAP_MIN, WATERMARK_GAP_MAX) ??
        defaults.normal.gapY,
      offsetX:
        normalizeOptionalNumber(normal.offsetX, WATERMARK_OFFSET_MIN, WATERMARK_OFFSET_MAX) ??
        defaults.normal.offsetX,
      offsetY:
        normalizeOptionalNumber(normal.offsetY, WATERMARK_OFFSET_MIN, WATERMARK_OFFSET_MAX) ??
        defaults.normal.offsetY,
    },
  };
}

function normalizeRuntimeTopicConfig(rawTopic: unknown): RuntimeTopicConfig {
  const topic = configObject(rawTopic);
  const levels = configObject(topic.levels);
  const normalizedLevels: Record<string, { maxWidth: number }> = {};

  for (const level of LEVEL_SUFFIXES) {
    const maxWidth = normalizeOptionalNumber(
      configObject(levels[level]).maxWidth,
      TOPIC_MAX_WIDTH_MIN,
      TOPIC_MAX_WIDTH_MAX
    );
    if (maxWidth) normalizedLevels[level] = { maxWidth };
  }

  return {
    defaultColor: normalizeText(topic.defaultColor),
    maxWidth:
      normalizeOptionalNumber(topic.maxWidth, TOPIC_MAX_WIDTH_MIN, TOPIC_MAX_WIDTH_MAX) ||
      DEFAULT_MIND_CONFIG.structure.topicMaxWidth.global,
    levels: normalizedLevels,
  };
}

export function normalizeTopicConfig(rawTheme: unknown, rawLayout: unknown): RuntimeTopicConfig {
  const color = configObject(rawTheme);
  const topicMaxWidth = configObject(configObject(rawLayout).topicMaxWidth);
  const normalizedLevels: Record<string, { maxWidth: number }> = {};

  for (const level of LEVEL_SUFFIXES) {
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
      DEFAULT_MIND_CONFIG.structure.topicMaxWidth.global,
    levels: normalizedLevels,
  };
}

function normalizeAdvancedStructureColorConfig(rawConfig: unknown) {
  const config = configObject(rawConfig);
  const defaults = DEFAULT_MIND_CONFIG.color.advancedStructure;
  return {
    relation: normalizeText(config.relation) || defaults.relation,
    summary: normalizeText(config.summary) || defaults.summary,
    boundary: normalizeText(config.boundary) || defaults.boundary,
  };
}

export function normalizeButtonConfig(
  rawTheme: unknown,
  rawInteraction: unknown = {}
): RuntimeButtonConfig {
  const color = configObject(rawTheme);
  const interaction = configObject(rawInteraction);
  const colorMode = normalizeText(color.buttonColorMode).toLowerCase();
  return {
    colorMode: includesValue(BUTTON_COLOR_MODES, colorMode)
      ? colorMode
      : DEFAULT_MIND_CONFIG.color.buttonColorMode,
    color: normalizeText(color.buttonColor),
    topicControlVisibility:
      normalizeTopicControlVisibility(interaction.topicControlVisibility) ||
      DEFAULT_MIND_CONFIG.interaction.topicControlVisibility,
  };
}

export function normalizeRuntimeButtonConfig(rawButton: unknown): RuntimeButtonConfig {
  const button = configObject(rawButton);
  const colorMode = normalizeText(button.colorMode).toLowerCase();
  return {
    colorMode: includesValue(BUTTON_COLOR_MODES, colorMode)
      ? colorMode
      : DEFAULT_MIND_CONFIG.color.buttonColorMode,
    color: normalizeText(button.color),
    topicControlVisibility:
      normalizeTopicControlVisibility(button.topicControlVisibility) ||
      DEFAULT_MIND_CONFIG.interaction.topicControlVisibility,
  };
}

export function normalizeFontConfig(rawFont: unknown): RuntimeFontConfig {
  const font = configObject(rawFont);
  const normalizedLevels: Record<string, RuntimePartialFont> = {};

  for (const level of LEVEL_SUFFIXES) {
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
    align: normalizeTextAlign(font.align) || DEFAULT_MIND_CONFIG.font.align,
    levels: normalizedLevels,
  };
}

export function normalizePartialFont(rawFont: unknown): RuntimePartialFont {
  const font = configObject(rawFont);
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

export function resolveTopicFont(topic: RuntimeTopicLike, config: unknown) {
  const safeConfig = normalizeMindConfig(config);
  const levelFont = safeConfig.font.levels[String(topic.level || 1)] || {};
  const attributes = configObject(topic.attributes);

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
    align: normalizeTextAlign(attributes.align) || safeConfig.font.align,
  };
}

export function resolveTopicMaxWidth(topic: RuntimeTopicLike, config: unknown): number {
  const safeConfig = normalizeMindConfig(config);
  const levelTopic = safeConfig.topic.levels[String(topic.level || 1)] || {};
  return (
    normalizeOptionalNumber(topic.attributes?.maxWidth, TOPIC_MAX_WIDTH_MIN, TOPIC_MAX_WIDTH_MAX) ||
    levelTopic.maxWidth ||
    safeConfig.topic.maxWidth ||
    DEFAULT_MIND_CONFIG.structure.topicMaxWidth.global
  );
}

export function normalizeText(value: unknown): string {
  if (value && typeof value === 'object') return '';
  return String(value || '').trim();
}

export function normalizeOptionalNumber(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, number));
}

export function normalizeLayoutType(value: unknown): string {
  return normalizeEnum(value, RUNTIME_LAYOUT_TYPES);
}

export function normalizeConnectorStyle(value: unknown): string {
  return normalizeEnum(value, RUNTIME_CONNECTOR_STYLES);
}

export function normalizeBranchExpansion(value: unknown): string {
  return normalizeEnum(value, RUNTIME_BRANCH_EXPANSIONS);
}

export function normalizeTopicControlVisibility(value: unknown): string {
  return normalizeEnum(value, TOPIC_CONTROL_VISIBILITY_MODES);
}

export function normalizeToolbarCorner(value: unknown): string {
  return normalizeEnum(value, TOOLBAR_CORNERS);
}

export function normalizeToolbarPlacement(value: unknown): string {
  return normalizeEnum(value, TOOLBAR_PLACEMENTS);
}

export function normalizeViewMode(value: unknown): string {
  return normalizeEnum(value, VIEW_MODES);
}

export function normalizeViewFit(value: unknown): string {
  return normalizeEnum(value, VIEW_FIT_MODES);
}

export function normalizeTextAlign(value: unknown): string {
  return normalizeEnum(value, TEXT_ALIGN_VALUES);
}

function normalizeEnum(value: unknown, values: readonly string[]): string {
  const text = normalizeText(value).toLowerCase();
  return includesValue(values, text) ? text : '';
}

function includesValue(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

function configObject(value: unknown): RawMindConfig {
  return isPlainObject(value) ? value : {};
}
