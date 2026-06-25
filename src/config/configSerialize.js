/*
 * 文件作用：
 * 配置区拆分、保存前裁剪和 yxmm 源码拼接。
 */

import { deleteMindConfigPath, isPlainObject, mergeMindConfigSources } from './configAccessors.js';
import { canonicalizeMindConfig } from './configCanonicalize.js';
import { normalizeConnectorStyle, normalizeLayoutType } from './configNormalize.js';
import { parseSimpleYaml, stringifySimpleYaml } from './yamlConfig.js';
import {
  BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS,
  CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS,
  DEFAULT_MIND_CONFIG,
} from './defaultMindConfig.js';

export function splitMindSourceConfig(source) {
  const text = String(source || '');
  const lines = text.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim() !== '');

  if (firstContentIndex === -1 || lines[firstContentIndex].trim() !== '---') {
    return {
      hasConfig: false,
      rawConfig: {},
      body: text,
    };
  }

  const endIndex = lines.findIndex(
    (line, index) => index > firstContentIndex && line.trim() === '---'
  );

  if (endIndex === -1) {
    throw new Error('配置区缺少结束的 ---。');
  }

  const configLines = lines.slice(firstContentIndex + 1, endIndex);
  const bodyLines = [...lines.slice(0, firstContentIndex), ...lines.slice(endIndex + 1)];

  return {
    hasConfig: true,
    rawConfig: canonicalizeMindConfig(parseSimpleYaml(configLines)),
    body: bodyLines.join('\n').trimStart(),
  };
}

/*
 * 作用：
 * 裁剪当前布局/线型下不生效的配置项，保持配置区精简。
 *
 * 参数：
 * - rawConfig：待裁剪的原始配置（通常是代码块配置区）。
 * - baseConfig：基础来源配置（通常是全局默认值配置），用于判断某些依赖项的有效状态。
 *
 * 裁剪规则：
 * - 思维导图非折线线型下，移除下挂展开配置。
 * - 非适配视图模式下，移除适配视图子配置。
 * - 开启"不放大"时，移除最大放大倍数配置。
 *
 * 返回：
 * 裁剪后的新配置对象。
 */
export function pruneInactiveMindConfig(rawConfig, baseConfig = {}) {
  let next = canonicalizeMindConfig(rawConfig);
  const base = canonicalizeMindConfig(baseConfig);
  next = pruneInactiveBranchExpansionConfig(next, base);
  next = pruneInactiveViewFitConfig(next, base);
  next = pruneInactiveButtonColorConfig(next, base);
  return next;
}

/*
 * 作用：
 * structure.branchExpansion 依赖当前布局和连线线型。
 *
 * 关键点：
 * 思维导图组只有有效 connectorStyle 为 elbow 时才保留；非思维导图布局如果支持下挂，
 * 因为实际线型固定为折线，可以保留。有效配置由全局默认值和当前文档配置合并得出。
 */
function pruneInactiveBranchExpansionConfig(config, baseConfig) {
  const structure = isPlainObject(config.structure) ? config.structure : {};
  if (structure.branchExpansion === undefined) return config;

  const effective = mergeMindConfigSources(baseConfig, config);
  const effectiveStructure = isPlainObject(effective.structure) ? effective.structure : {};
  const layoutType =
    normalizeLayoutType(effectiveStructure.layout) || DEFAULT_MIND_CONFIG.structure.layout;
  const connectorStyle = normalizeConnectorStyle(effectiveStructure.connectorStyle);
  const isUnsupportedLayout = BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS.includes(layoutType);
  const isConnectorConfigurableLayout = CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS.includes(layoutType);

  if (isUnsupportedLayout || (isConnectorConfigurableLayout && connectorStyle !== 'elbow')) {
    return deleteMindConfigPath(config, ['structure', 'branchExpansion']);
  }

  return config;
}

/*
 * 作用：
 * 适配视图子配置依赖 display.viewFit。
 *
 * 规则：
 * 只有有效 viewFit 为 fit 时才保留适配视图子配置；开启“不放大”时，最大放大倍数不生效，
 * 因此也会被移除。有效配置由全局默认值和当前文档配置合并得出。
 */
function pruneInactiveViewFitConfig(config, baseConfig) {
  const effective = mergeMindConfigSources(baseConfig, config);
  const display = isPlainObject(effective.display) ? effective.display : {};
  const viewFit = display.viewFit ?? DEFAULT_MIND_CONFIG.display.viewFit;
  let next = config;

  if (viewFit !== 'fit') {
    next = deleteMindConfigPath(next, ['display', 'fitViewNoUpscale']);
    next = deleteMindConfigPath(next, ['display', 'fitViewMaxScale']);
    return next;
  }

  if (display.fitViewNoUpscale !== false) {
    next = deleteMindConfigPath(next, ['display', 'fitViewMaxScale']);
  }

  return next;
}

/*
 * 作用：
 * buttonColor 只有在 buttonColorMode 为 custom 时才生效。
 *
 * 规则：
 * 只有有效 buttonColorMode 为 custom 时才保留 buttonColor；
 * 否则移除 buttonColor，避免残留自定义颜色值。
 */
function pruneInactiveButtonColorConfig(config, baseConfig) {
  const effective = mergeMindConfigSources(baseConfig, config);
  const color = isPlainObject(effective.color) ? effective.color : {};
  const buttonColorMode = String(color.buttonColorMode || '').toLowerCase();

  if (buttonColorMode !== 'custom') {
    return deleteMindConfigPath(config, ['color', 'buttonColor']);
  }

  return config;
}

/*
 * 作用：
 * 把原始配置和正文拼接成 yxmm 源码。
 *
 * 参数：
 * - rawConfig：配置区原始配置。
 * - body：正文区文本。
 * - forceConfig：是否强制写入配置区，即使配置为空。
 * - baseConfig：基础来源配置（可选），传入后 prune 时会结合基础配置判断哪些配置项不生效。
 *
 * 返回：
 * 拼接后的 yxmm 源码字符串。
 */
export function serializeMindSource(rawConfig, body, forceConfig, baseConfig) {
  const config = pruneInactiveMindConfig(rawConfig, baseConfig);
  const bodyText = String(body || '').trim();
  const shouldWriteConfig = forceConfig || hasMeaningfulConfig(config);

  if (!shouldWriteConfig) return bodyText;

  const configText = stringifySimpleYaml(config);
  return ['---', configText, '---', '', bodyText].join('\n').trimEnd();
}

/*
 * 作用：
 * 判断配置对象里是否真的有内容。
 */
export function hasMeaningfulConfig(config) {
  return isPlainObject(config) && Object.keys(config).length > 0;
}
