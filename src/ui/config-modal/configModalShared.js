/*
 * 文件作用：
 * 汇总配置面板子模块共享的依赖。
 */

export { Notice, setIcon } from 'obsidian';
export {
  cloneConfig,
  deleteConfigValue,
  getConfigValue,
  numberFromInput,
  parseDraftConfigText,
  setConfigValue,
  stringifyDraftConfig,
} from '../../config/configDraft.js';
import {
  BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS,
  CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS,
} from '../../config/mindConfig.js';
export {
  BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS,
  BRANCH_EXPANSIONS,
  BUTTON_COLOR_MODES,
  BUTTON_COLOR_PRESETS,
  CANVAS_MAX_HEIGHT,
  CANVAS_MIN_HEIGHT,
  CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS,
  CONNECTOR_STYLES,
  CUSTOM_FONT_VALUE,
  DEFAULT_BUTTON_COLOR,
  DEFAULT_FONT_FAMILY,
  FIT_VIEW_MAX_SCALE_MAX,
  FIT_VIEW_MAX_SCALE_MIN,
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  LAYOUT_OPTION_GROUPS,
  THEME_SCHEMES,
  TOPIC_CONTROL_VISIBILITY_MODES,
  TOPIC_MAX_WIDTH_MAX,
  TOPIC_MAX_WIDTH_MIN,
  TOOLBAR_CORNERS,
  TOOLBAR_PLACEMENTS,
  VIEW_FIT_MODES,
  canonicalizeMindConfig,
  mergeMindConfigObjects,
  mergeMindConfigSources,
  normalizeMindConfig,
  pruneInactiveMindConfig,
} from '../../config/mindConfig.js';
export { createTranslator } from '../../i18n/messages.js';
export {
  getLocalizedFontFamilyGroups,
  isValidFontFamilyInput,
  normalizeFontFamilyInput,
} from '../fontOptions.js';
export { clamp } from '../../utils/math.js';

export const RAINBOW_THEME_NAMES = new Set(['rainbow', 'pastel-rainbow', 'neon-rainbow']);

export function isConnectorStyleConfigurableLayout(layout) {
  return CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS.includes(String(layout || ''));
}

export function isBranchExpansionSupportedLayout(layout) {
  return !BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS.includes(String(layout || ''));
}

export function isBranchExpansionConfigurable(layout, connectorStyle) {
  if (!isBranchExpansionSupportedLayout(layout)) return false;
  if (isConnectorStyleConfigurableLayout(layout)) return connectorStyle === 'elbow';
  return true;
}
