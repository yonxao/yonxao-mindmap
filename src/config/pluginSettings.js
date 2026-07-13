/*
 * 文件作用：
 * 这里定义 Obsidian 插件级别的持久化设置，也就是会写入插件 data.json 的数据结构。
 *
 * 当前功能：
 * - language：插件界面语言。
 * - defaultConfig：持久化字段名，保存全局默认值配置，作为所有 yxmm 代码块的基础配置。
 *
 * 执行逻辑：
 * 1. YonxaoMindmapPlugin.onload() 调用 loadSettings()。
 * 2. Obsidian 从 data.json 读取原始数据。
 * 3. normalizePluginSettings() 清洗成稳定结构；如果首次没有保存 language，则使用 Obsidian 当前语言。
 * 4. Renderer 渲染时读取 defaultConfig，再让单个文档的配置区覆盖它。
 *
 * 注意：
 * 这里保存的是“插件偏好设置”，不是某个 Markdown 文档的配置区。
 */

import { FALLBACK_LANGUAGE, normalizeLanguage } from '../i18n/messages.js';
import { canonicalizeMindConfig } from './configCanonicalize.js';
import { isPlainObject } from './configAccessors.js';

export const DEFAULT_PLUGIN_SETTINGS = Object.freeze({
  language: FALLBACK_LANGUAGE,
  defaultConfig: Object.freeze({}),
  watermarkUnlocked: false,
});

/*
 * 作用：
 * 把 Obsidian 读取到的原始设置清洗为插件内部稳定使用的结构。
 *
 * 关键点：
 * 当前插件还没有发布，不保留旧字段兼容逻辑。
 * 如果 data.json 中不是插件当前定义的结构，就回退到空默认配置。
 */
export function normalizePluginSettings(rawSettings, defaultLanguage = FALLBACK_LANGUAGE) {
  const settings = isPlainObject(rawSettings) ? rawSettings : {};
  return {
    language: normalizeLanguage(settings.language, defaultLanguage),
    defaultConfig: isPlainObject(settings.defaultConfig)
      ? canonicalizeMindConfig(settings.defaultConfig)
      : {},
    watermarkUnlocked: settings.watermarkUnlocked === true,
  };
}
