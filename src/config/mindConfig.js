/*
 * 文件作用：
 * yxmm 配置系统对外聚合入口，保持旧 import 路径稳定。
 *
 * 具体实现已按职责拆到 configAccessors、yamlConfig、configNormalize、configSerialize。
 */

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
  DEFAULT_MIND_CONFIG,
  FIT_VIEW_MAX_SCALE_MAX,
  FIT_VIEW_MAX_SCALE_MIN,
  FONT_FAMILY_GROUPS,
  FONT_FAMILY_OPTIONS,
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  LAYOUT_OPTION_GROUPS,
  LAYOUT_TYPES,
  THEME_SCHEMES,
  TOOLBAR_CORNERS,
  TOOLBAR_PLACEMENTS,
  TOPIC_CONTROL_VISIBILITY_MODES,
  TOPIC_MAX_WIDTH_MAX,
  TOPIC_MAX_WIDTH_MIN,
  VIEW_FIT_MODES,
  VIEW_MODES,
} from './defaultMindConfig.js';

export {
  clonePlainObject,
  deleteMindConfigPath,
  deepMergePlainObjects,
  isPlainObject,
  mergeMindConfigObjects,
  setConfigValueIfPresent,
  setMindConfigPath,
} from './configAccessors.js';
export { canonicalizeMindConfig } from './configCanonicalize.js';
export {
  normalizeBranchExpansion,
  normalizeButtonConfig,
  normalizeConnectorStyle,
  normalizeFontConfig,
  normalizeLayoutType,
  normalizeMindConfig,
  normalizeOptionalNumber,
  normalizePartialFont,
  normalizeRuntimeButtonConfig,
  normalizeText,
  normalizeToolbarCorner,
  normalizeToolbarPlacement,
  normalizeTopicConfig,
  normalizeTopicControlVisibility,
  normalizeViewFit,
  normalizeViewMode,
  resolveTopicFont,
  resolveTopicMaxWidth,
} from './configNormalize.js';
export {
  hasMeaningfulConfig,
  pruneInactiveMindConfig,
  serializeMindSource,
  splitMindSourceConfig,
} from './configSerialize.js';
export { parseSimpleYaml, stringifySimpleYaml } from './yamlConfig.js';
