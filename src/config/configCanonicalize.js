/*
 * 文件作用：
 * 将用户输入配置清理成当前 yxmm 配置区结构。
 */

import { isPlainObject, setConfigValueIfPresent } from './configAccessors.js';

export function canonicalizeMindConfig(rawConfig) {
  const raw = isPlainObject(rawConfig) ? rawConfig : {};
  const next = {};

  const basic = isPlainObject(raw.basic) ? raw.basic : {};
  setConfigValueIfPresent(next, ['basic', 'canvasHeight'], basic.canvasHeight);
  setConfigValueIfPresent(next, ['basic', 'sourceHeight'], basic.sourceHeight);
  const basicToolbar = isPlainObject(basic.toolbar) ? basic.toolbar : {};
  setConfigValueIfPresent(next, ['basic', 'toolbar', 'corner'], basicToolbar.corner);
  setConfigValueIfPresent(next, ['basic', 'toolbar', 'placement'], basicToolbar.placement);
  setConfigValueIfPresent(next, ['basic', 'viewFit'], basic.viewFit);
  setConfigValueIfPresent(next, ['basic', 'fitViewNoUpscale'], basic.fitViewNoUpscale);
  setConfigValueIfPresent(next, ['basic', 'fitViewMaxScale'], basic.fitViewMaxScale);
  setConfigValueIfPresent(next, ['basic', 'tabIndent'], basic.tabIndent);
  setConfigValueIfPresent(next, ['basic', 'wheelZoom'], basic.wheelZoom);

  const theme = isPlainObject(raw.theme) ? raw.theme : {};
  setConfigValueIfPresent(next, ['theme', 'scheme'], theme.scheme);
  setConfigValueIfPresent(next, ['theme', 'defaultTopicColor'], theme.defaultTopicColor);
  setConfigValueIfPresent(next, ['theme', 'buttonColorMode'], theme.buttonColorMode);
  setConfigValueIfPresent(next, ['theme', 'buttonColor'], theme.buttonColor);

  const layout = isPlainObject(raw.layout) ? raw.layout : {};
  const topicMaxWidth = isPlainObject(layout.topicMaxWidth) ? layout.topicMaxWidth : {};
  setConfigValueIfPresent(next, ['layout', 'type'], layout.type);
  setConfigValueIfPresent(next, ['layout', 'connectorStyle'], layout.connectorStyle);
  setConfigValueIfPresent(next, ['layout', 'branchExpansion'], layout.branchExpansion);
  setConfigValueIfPresent(next, ['layout', 'topicMaxWidth', 'global'], topicMaxWidth.global);
  for (const levelKey of ['level1', 'level2', 'level3']) {
    setConfigValueIfPresent(next, ['layout', 'topicMaxWidth', levelKey], topicMaxWidth[levelKey]);
  }

  const font = isPlainObject(raw.font) ? raw.font : {};
  for (const key of ['family', 'size', 'weight', 'lineHeight']) {
    setConfigValueIfPresent(next, ['font', key], font[key]);
  }
  for (const levelKey of ['level1', 'level2', 'level3']) {
    const levelConfig = isPlainObject(font[levelKey]) ? font[levelKey] : {};
    for (const fontKey of ['family', 'size', 'weight', 'lineHeight']) {
      setConfigValueIfPresent(next, ['font', levelKey, fontKey], levelConfig[fontKey]);
    }
  }

  return next;
}
