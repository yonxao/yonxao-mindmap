/*
 * 文件作用：
 * 将用户输入配置清理成当前 yxmm 配置区结构。
 *
 * 当前配置区按用户在配置面板中的操作心智分组：
 * - display：显示区域和初始视图。
 * - structure：导图结构、连线和主题宽度。
 * - color：配色方案、默认主题色和按钮颜色。
 * - font：全局字体和按主题级别字体覆盖。
 * - interaction：工具栏、主题按钮和鼠标键盘交互。
 * - watermark：签名或普通水印及其显示参数。
 *
 * 项目仍处开发阶段，不保留旧 basic/theme/layout 聚合结构兼容。
 */

import { isPlainObject, setConfigValueIfPresent } from './configAccessors.js';
import {
  FONT_LEVEL_FIELD_KEYS,
  FONT_LEVEL_KEYS,
  WATERMARK_NORMAL_CONFIG_KEYS,
  WATERMARK_SIGNATURE_CONFIG_KEYS,
} from './defaultMindConfig.js';

export function canonicalizeMindConfig(rawConfig) {
  const raw = isPlainObject(rawConfig) ? rawConfig : {};
  const next = {};

  const display = isPlainObject(raw.display) ? raw.display : {};
  setConfigValueIfPresent(next, ['display', 'canvasHeight'], display.canvasHeight);
  setConfigValueIfPresent(next, ['display', 'sourceHeight'], display.sourceHeight);
  setConfigValueIfPresent(next, ['display', 'viewFit'], display.viewFit);
  setConfigValueIfPresent(next, ['display', 'fitViewNoUpscale'], display.fitViewNoUpscale);
  setConfigValueIfPresent(next, ['display', 'fitViewMaxScale'], display.fitViewMaxScale);
  setConfigValueIfPresent(next, ['display', 'saveFullConfig'], display.saveFullConfig);

  const structure = isPlainObject(raw.structure) ? raw.structure : {};
  const topicMaxWidth = isPlainObject(structure.topicMaxWidth) ? structure.topicMaxWidth : {};
  setConfigValueIfPresent(next, ['structure', 'layout'], structure.layout);
  setConfigValueIfPresent(next, ['structure', 'connectorStyle'], structure.connectorStyle);
  setConfigValueIfPresent(next, ['structure', 'branchExpansion'], structure.branchExpansion);
  setConfigValueIfPresent(next, ['structure', 'topicMaxWidth', 'global'], topicMaxWidth.global);
  for (const levelKey of FONT_LEVEL_KEYS) {
    setConfigValueIfPresent(
      next,
      ['structure', 'topicMaxWidth', levelKey],
      topicMaxWidth[levelKey]
    );
  }

  const color = isPlainObject(raw.color) ? raw.color : {};
  setConfigValueIfPresent(next, ['color', 'scheme'], color.scheme);
  setConfigValueIfPresent(next, ['color', 'defaultTopicColor'], color.defaultTopicColor);
  setConfigValueIfPresent(next, ['color', 'buttonColorMode'], color.buttonColorMode);
  setConfigValueIfPresent(next, ['color', 'buttonColor'], color.buttonColor);
  // 规范化 advancedStructure 颜色子字段，与 relation/summary/boundary 三个结构类型一一对应。
  const advancedStructure = isPlainObject(color.advancedStructure) ? color.advancedStructure : {};
  setConfigValueIfPresent(
    next,
    ['color', 'advancedStructure', 'relation'],
    advancedStructure.relation
  );
  setConfigValueIfPresent(
    next,
    ['color', 'advancedStructure', 'summary'],
    advancedStructure.summary
  );
  setConfigValueIfPresent(
    next,
    ['color', 'advancedStructure', 'boundary'],
    advancedStructure.boundary
  );

  const interaction = isPlainObject(raw.interaction) ? raw.interaction : {};
  const toolbar = isPlainObject(interaction.toolbar) ? interaction.toolbar : {};
  setConfigValueIfPresent(next, ['interaction', 'toolbar', 'corner'], toolbar.corner);
  setConfigValueIfPresent(next, ['interaction', 'toolbar', 'placement'], toolbar.placement);
  setConfigValueIfPresent(
    next,
    ['interaction', 'topicControlVisibility'],
    interaction.topicControlVisibility
  );
  setConfigValueIfPresent(next, ['interaction', 'tabIndent'], interaction.tabIndent);
  setConfigValueIfPresent(next, ['interaction', 'wheelZoom'], interaction.wheelZoom);

  const font = isPlainObject(raw.font) ? raw.font : {};
  for (const key of FONT_LEVEL_FIELD_KEYS) {
    setConfigValueIfPresent(next, ['font', key], font[key]);
  }
  setConfigValueIfPresent(next, ['font', 'align'], font.align);
  for (const levelKey of FONT_LEVEL_KEYS) {
    const levelConfig = isPlainObject(font[levelKey]) ? font[levelKey] : {};
    for (const fontKey of FONT_LEVEL_FIELD_KEYS) {
      setConfigValueIfPresent(next, ['font', levelKey, fontKey], levelConfig[fontKey]);
    }
  }

  const watermark = isPlainObject(raw.watermark) ? raw.watermark : {};
  const signature = isPlainObject(watermark.signature) ? watermark.signature : {};
  const normal = isPlainObject(watermark.normal) ? watermark.normal : {};
  setConfigValueIfPresent(next, ['watermark', 'enabled'], watermark.enabled);
  setConfigValueIfPresent(next, ['watermark', 'mode'], watermark.mode);
  for (const key of WATERMARK_SIGNATURE_CONFIG_KEYS) {
    setConfigValueIfPresent(next, ['watermark', 'signature', key], signature[key]);
  }
  for (const key of WATERMARK_NORMAL_CONFIG_KEYS) {
    setConfigValueIfPresent(next, ['watermark', 'normal', key], normal[key]);
  }

  return next;
}
