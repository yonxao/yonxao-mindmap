/*
 * 文件作用：
 * 这里维护 yonxao-mindmap 的界面文案国际化入口。
 *
 * 调用链：
 * YonxaoMindmapPlugin.t() -> translate() -> 当前语言包文案。
 *
 * 具体语言文案已拆到 locales/，本文件只保留外部稳定 API。
 */

import { FALLBACK_LANGUAGE, normalizeLanguage } from './languageOptions.js';
import { enMessages } from './locales/en.js';
import { eastAsianLocaleMessages } from './locales/eastAsian.js';
import { europeanLocaleMessages } from './locales/european.js';
import { globalSouthLocaleMessages } from './locales/globalSouth.js';
import { zhCNMessages } from './locales/zhCN.js';
import { zhTWMessages } from './locales/zhTW.js';

export {
  FALLBACK_LANGUAGE,
  LANGUAGE_OPTIONS,
  languageFromObsidianLocale,
  normalizeLanguage,
} from './languageOptions.js';

const LOCALE_MESSAGES = Object.freeze({
  en: enMessages,
  'zh-CN': zhCNMessages,
  'zh-TW': zhTWMessages,
  ...eastAsianLocaleMessages,
  ...europeanLocaleMessages,
  ...globalSouthLocaleMessages,
});

/*
 * 作用：
 * 根据语言代码创建翻译函数。
 */
export function createTranslator(language) {
  const normalizedLanguage = normalizeLanguage(language);
  return (key, replacements) => translate(normalizedLanguage, key, replacements);
}

/*
 * 作用：
 * 读取翻译文本，并支持简单的 {name} 占位符替换。
 */
export function translate(language, key, replacements = {}) {
  const normalizedLanguage = normalizeLanguage(language);
  const messages = LOCALE_MESSAGES[normalizedLanguage] || LOCALE_MESSAGES[FALLBACK_LANGUAGE];
  const fallbackMessages = LOCALE_MESSAGES[FALLBACK_LANGUAGE];
  const template = messages[key] ?? fallbackMessages[key] ?? key;

  return String(template).replace(/\{([^}]+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(replacements, name) ? replacements[name] : match
  );
}
