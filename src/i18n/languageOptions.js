export const FALLBACK_LANGUAGE = 'en';

export const LANGUAGE_OPTIONS = Object.freeze([
  ['en', 'English'],
  ['zh-CN', '中文（简体）'],
  ['zh-TW', '中文（繁體）'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['pt-BR', 'Português (Brasil)'],
  ['ru', 'Русский'],
  ['it', 'Italiano'],
  ['id', 'Bahasa Indonesia'],
  ['tr', 'Türkçe'],
  ['vi', 'Tiếng Việt'],
  ['th', 'ไทย'],
  ['hi', 'हिन्दी'],
]);

/*
 * 作用：
 * 把 Obsidian 返回的语言标识映射到插件支持的语言代码。
 *
 * 关键点：
 * Obsidian 语言可能是 zh、zh-cn、zh-tw、pt-br 这类格式；插件内部统一使用
 * LANGUAGE_OPTIONS 中声明的稳定代码。
 */
export function languageFromObsidianLocale(locale) {
  const value = String(locale || '')
    .trim()
    .replace(/_/g, '-');
  const lowerValue = value.toLowerCase();

  if (lowerValue === 'zh' || lowerValue === 'zh-cn' || lowerValue === 'zh-hans') {
    return 'zh-CN';
  }
  if (
    lowerValue === 'zh-tw' ||
    lowerValue === 'zh-hk' ||
    lowerValue === 'zh-mo' ||
    lowerValue === 'zh-hant'
  ) {
    return 'zh-TW';
  }
  if (lowerValue === 'pt-br') return 'pt-BR';

  const exactMatch = LANGUAGE_OPTIONS.find(([language]) => language.toLowerCase() === lowerValue);
  if (exactMatch) return exactMatch[0];

  const primaryLanguage = lowerValue.split('-')[0];
  const primaryMatch = LANGUAGE_OPTIONS.find(([language]) => language === primaryLanguage);
  return primaryMatch ? primaryMatch[0] : FALLBACK_LANGUAGE;
}

/*
 * 作用：
 * 规范化语言代码，只允许当前插件声明支持的语言。
 */
export function normalizeLanguage(language, fallbackLanguage = FALLBACK_LANGUAGE) {
  const value = String(language || '').trim();
  if (LANGUAGE_OPTIONS.some(([optionValue]) => optionValue === value)) return value;
  return LANGUAGE_OPTIONS.some(([optionValue]) => optionValue === fallbackLanguage)
    ? fallbackLanguage
    : FALLBACK_LANGUAGE;
}
