/*
 * 文件作用：
 * 定义跨宿主共享的 yxmm 文档配置契约，包括字段白名单、来源合并和保存裁剪。
 */

import {
  LAYOUT_MODES,
  MINDMAP_LAYOUT_MODES,
  RADIAL_LAYOUT_MODES,
  TREE_TABLE_LAYOUT_MODES,
} from '../layout/layoutTree.js';
import {
  serializeMindSource,
  splitMindSourceConfig,
  type MindSourceConfig,
} from '../parser/mindDocument.js';
import {
  FONT_LEVEL_FIELD_KEYS,
  FONT_LEVEL_KEYS,
  WATERMARK_NORMAL_CONFIG_KEYS,
  WATERMARK_SIGNATURE_CONFIG_KEYS,
  isPlainObject,
  type RawMindConfig,
} from '../parser/simpleYaml.js';

export const CONNECTOR_STYLES = Object.freeze(['curve', 'straight', 'elbow'] as const);
export const BRANCH_EXPANSIONS = Object.freeze(['side', 'hanging'] as const);
export const CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS = MINDMAP_LAYOUT_MODES;
export const BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS = Object.freeze([
  ...RADIAL_LAYOUT_MODES,
  ...TREE_TABLE_LAYOUT_MODES,
] as const);
export const DEFAULT_DOCUMENT_LAYOUT = 'mindmap-right';
export const DEFAULT_DOCUMENT_VIEW_FIT = 'fit';

export type ConnectorStyle = (typeof CONNECTOR_STYLES)[number];
export type BranchExpansion = (typeof BRANCH_EXPANSIONS)[number];

export function mergeMindConfigObjects(
  baseConfig: unknown,
  overrideConfig: unknown
): RawMindConfig {
  return deepMergePlainObjects(
    isPlainObject(baseConfig) ? baseConfig : {},
    isPlainObject(overrideConfig) ? overrideConfig : {}
  );
}

/*
 * 高优先级来源的全局值需要遮蔽低优先级来源的同字段 levelN 值，
 * 否则代码块全局配置会意外输给插件全局默认中的层级配置。
 */
export function mergeMindConfigSources(
  baseConfig: unknown,
  overrideConfig: unknown
): RawMindConfig {
  const override = isPlainObject(overrideConfig) ? overrideConfig : {};
  const merged = mergeMindConfigObjects(baseConfig, override);
  applyTopicMaxWidthSourceInheritance(merged, override);
  applyFontSourceInheritance(merged, override);
  return merged;
}

function applyTopicMaxWidthSourceInheritance(merged: RawMindConfig, override: RawMindConfig): void {
  const overrideStructure = plainChild(override, 'structure');
  const overrideTopicMaxWidth = plainChild(overrideStructure, 'topicMaxWidth');
  if (!Object.prototype.hasOwnProperty.call(overrideTopicMaxWidth, 'global')) return;

  const mergedStructure = plainChild(merged, 'structure');
  const mergedTopicMaxWidth = plainChild(mergedStructure, 'topicMaxWidth');
  for (const levelKey of FONT_LEVEL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(overrideTopicMaxWidth, levelKey)) {
      delete mergedTopicMaxWidth[levelKey];
    }
  }
}

function applyFontSourceInheritance(merged: RawMindConfig, override: RawMindConfig): void {
  const overrideFont = plainChild(override, 'font');
  const mergedFont = plainChild(merged, 'font');

  for (const fontKey of FONT_LEVEL_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(overrideFont, fontKey)) continue;

    for (const levelKey of FONT_LEVEL_KEYS) {
      const overrideLevel = plainChild(overrideFont, levelKey);
      if (Object.prototype.hasOwnProperty.call(overrideLevel, fontKey)) continue;

      const mergedLevel = plainChild(mergedFont, levelKey);
      delete mergedLevel[fontKey];
      if (!Object.keys(mergedLevel).length) delete mergedFont[levelKey];
    }
  }
}

export function setMindConfigPath(
  rawConfig: unknown,
  path: readonly string[],
  value: unknown
): RawMindConfig {
  const next = clonePlainObject(rawConfig);
  if (!path.length) return next;
  let current = next;

  for (const key of path.slice(0, -1)) {
    if (!isPlainObject(current[key])) current[key] = {};
    current = current[key] as RawMindConfig;
  }

  current[path[path.length - 1]] = value;
  return next;
}

export function deleteMindConfigPath(rawConfig: unknown, path: readonly string[]): RawMindConfig {
  const next = clonePlainObject(rawConfig);
  if (!path.length) return next;
  const parents: Array<[RawMindConfig, string]> = [];
  let current = next;

  for (const key of path.slice(0, -1)) {
    if (!isPlainObject(current[key])) return next;
    parents.push([current, key]);
    current = current[key] as RawMindConfig;
  }

  delete current[path[path.length - 1]];
  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const [parent, key] = parents[index];
    if (isPlainObject(parent[key]) && !Object.keys(parent[key]).length) delete parent[key];
  }

  return next;
}

export function clonePlainObject(value: unknown): RawMindConfig {
  if (!isPlainObject(value)) return {};
  return JSON.parse(JSON.stringify(value)) as RawMindConfig;
}

export function setConfigValueIfPresent(
  config: RawMindConfig,
  path: readonly string[],
  value: unknown
): RawMindConfig {
  if (!path.length || value === undefined || value === null || value === '') return config;

  let current = config;
  for (const key of path.slice(0, -1)) {
    if (!isPlainObject(current[key])) current[key] = {};
    current = current[key] as RawMindConfig;
  }

  current[path[path.length - 1]] = value;
  return config;
}

export function deepMergePlainObjects(base: RawMindConfig, override: RawMindConfig): RawMindConfig {
  const merged = clonePlainObject(base);

  for (const [key, overrideValue] of Object.entries(override)) {
    if (overrideValue === undefined) continue;

    const baseValue = merged[key];
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      merged[key] = deepMergePlainObjects(baseValue, overrideValue);
    } else if (isPlainObject(overrideValue)) {
      merged[key] = clonePlainObject(overrideValue);
    } else {
      merged[key] = overrideValue;
    }
  }

  return merged;
}

export function canonicalizeMindConfig(rawConfig: unknown): RawMindConfig {
  const raw = isPlainObject(rawConfig) ? rawConfig : {};
  const next: RawMindConfig = {};

  const display = plainChild(raw, 'display');
  copyConfigValues(next, ['display'], display, [
    'canvasHeight',
    'sourceHeight',
    'viewFit',
    'fitViewNoUpscale',
    'fitViewMaxScale',
    'saveFullConfig',
  ]);

  const structure = plainChild(raw, 'structure');
  copyConfigValues(next, ['structure'], structure, ['layout', 'connectorStyle', 'branchExpansion']);
  const topicMaxWidth = plainChild(structure, 'topicMaxWidth');
  copyConfigValues(next, ['structure', 'topicMaxWidth'], topicMaxWidth, [
    'global',
    ...FONT_LEVEL_KEYS,
  ]);

  const color = plainChild(raw, 'color');
  copyConfigValues(next, ['color'], color, [
    'scheme',
    'defaultTopicColor',
    'buttonColorMode',
    'buttonColor',
  ]);
  copyConfigValues(next, ['color', 'advancedStructure'], plainChild(color, 'advancedStructure'), [
    'relation',
    'summary',
    'boundary',
  ]);

  const interaction = plainChild(raw, 'interaction');
  copyConfigValues(next, ['interaction'], interaction, [
    'topicControlVisibility',
    'tabIndent',
    'wheelZoom',
  ]);
  copyConfigValues(next, ['interaction', 'toolbar'], plainChild(interaction, 'toolbar'), [
    'corner',
    'placement',
  ]);

  const font = plainChild(raw, 'font');
  copyConfigValues(next, ['font'], font, [...FONT_LEVEL_FIELD_KEYS, 'align']);
  for (const levelKey of FONT_LEVEL_KEYS) {
    copyConfigValues(next, ['font', levelKey], plainChild(font, levelKey), FONT_LEVEL_FIELD_KEYS);
  }

  const watermark = plainChild(raw, 'watermark');
  copyConfigValues(next, ['watermark'], watermark, ['enabled', 'mode']);
  const signature = plainChild(watermark, 'signature');
  copyConfigValues(next, ['watermark', 'signature'], signature, [
    'padding',
    ...WATERMARK_SIGNATURE_CONFIG_KEYS,
  ]);
  copyConfigValues(
    next,
    ['watermark', 'normal'],
    plainChild(watermark, 'normal'),
    WATERMARK_NORMAL_CONFIG_KEYS
  );

  return next;
}

function copyConfigValues(
  target: RawMindConfig,
  targetPath: readonly string[],
  source: RawMindConfig,
  keys: readonly string[]
): void {
  for (const key of keys) {
    setConfigValueIfPresent(target, [...targetPath, key], source[key]);
  }
}

export function normalizeDocumentLayout(value: unknown): string {
  const text = normalizeConfigText(value);
  return LAYOUT_MODES.includes(text as (typeof LAYOUT_MODES)[number]) ? text : '';
}

export function normalizeDocumentConnectorStyle(value: unknown): string {
  const text = normalizeConfigText(value);
  return CONNECTOR_STYLES.includes(text as ConnectorStyle) ? text : '';
}

export function normalizeDocumentBranchExpansion(value: unknown): string {
  const text = normalizeConfigText(value);
  return BRANCH_EXPANSIONS.includes(text as BranchExpansion) ? text : '';
}

function normalizeConfigText(value: unknown): string {
  if (value && typeof value === 'object') return '';
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function pruneInactiveMindConfig(
  rawConfig: unknown,
  baseConfig: unknown = {}
): RawMindConfig {
  let next = canonicalizeMindConfig(rawConfig);
  const base = canonicalizeMindConfig(baseConfig);
  next = pruneInactiveBranchExpansionConfig(next, base);
  next = pruneInactiveViewFitConfig(next, base);
  next = pruneInactiveButtonColorConfig(next, base);
  return next;
}

function pruneInactiveBranchExpansionConfig(
  config: RawMindConfig,
  baseConfig: RawMindConfig
): RawMindConfig {
  const structure = plainChild(config, 'structure');
  if (structure.branchExpansion === undefined) return config;

  const effectiveStructure = plainChild(mergeMindConfigSources(baseConfig, config), 'structure');
  const layout = normalizeDocumentLayout(effectiveStructure.layout) || DEFAULT_DOCUMENT_LAYOUT;
  const connectorStyle = normalizeDocumentConnectorStyle(effectiveStructure.connectorStyle);
  const unsupported = BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS.includes(
    layout as (typeof BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS)[number]
  );
  const connectorConfigurable = CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS.includes(
    layout as (typeof CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS)[number]
  );

  if (unsupported || (connectorConfigurable && connectorStyle !== 'elbow')) {
    return deleteMindConfigPath(config, ['structure', 'branchExpansion']);
  }
  return config;
}

function pruneInactiveViewFitConfig(
  config: RawMindConfig,
  baseConfig: RawMindConfig
): RawMindConfig {
  const display = plainChild(mergeMindConfigSources(baseConfig, config), 'display');
  const viewFit = display.viewFit ?? DEFAULT_DOCUMENT_VIEW_FIT;
  let next = config;

  if (viewFit !== 'fit') {
    next = deleteMindConfigPath(next, ['display', 'fitViewNoUpscale']);
    return deleteMindConfigPath(next, ['display', 'fitViewMaxScale']);
  }
  if (display.fitViewNoUpscale !== false) {
    next = deleteMindConfigPath(next, ['display', 'fitViewMaxScale']);
  }
  return next;
}

function pruneInactiveButtonColorConfig(
  config: RawMindConfig,
  baseConfig: RawMindConfig
): RawMindConfig {
  const color = plainChild(mergeMindConfigSources(baseConfig, config), 'color');
  if (String(color.buttonColorMode || '').toLowerCase() !== 'custom') {
    return deleteMindConfigPath(config, ['color', 'buttonColor']);
  }
  return config;
}

export function splitCanonicalMindSourceConfig(source: unknown): MindSourceConfig {
  const document = splitMindSourceConfig(source);
  return {
    ...document,
    rawConfig: canonicalizeMindConfig(document.rawConfig),
  };
}

export function serializeCanonicalMindSource(
  rawConfig: unknown,
  body: unknown,
  forceConfig = false,
  baseConfig: unknown = {}
): string {
  return serializeMindSource(pruneInactiveMindConfig(rawConfig, baseConfig), body, forceConfig);
}

function plainChild(value: RawMindConfig, key: string): RawMindConfig {
  return isPlainObject(value[key]) ? value[key] : {};
}
