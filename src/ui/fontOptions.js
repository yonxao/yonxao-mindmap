/*
 * 文件作用：
 * 这里提供字体选项本地化、字体输入规范化和字体值校验。
 *
 * 设计思路：
 * 字体预设值集合属于配置系统默认选项，定义在 defaultMindConfig.js。
 * UI 层只负责把 i18n key 翻译成当前语言文案，并校验用户手动输入的 CSS font-family。
 *
 * 调用链：
 * ConfigModal.renderFontTab()/createLevelFontGroup() -> getLocalizedFontFamilyGroups()。
 */

import { FONT_FAMILY_GROUPS, FONT_FAMILY_OPTIONS } from '../config/mindConfig.js';
export {
  CUSTOM_FONT_VALUE,
  FONT_FAMILY_GROUPS,
  FONT_FAMILY_OPTIONS,
} from '../config/mindConfig.js';

/*
 * 作用：
 * 根据当前语言生成字体下拉框选项。
 *
 * 实现逻辑：
 * FONT_FAMILY_GROUPS 的标签存储为 i18n key，这里通过 t() 翻译。
 */
/*
 * 作用：
 * 把本地化后的字体选项追加到 <select> 下拉框中。
 * 被配置面板和主题编辑面板复用，避免两处重复实现相同的 DOM 构建逻辑。
 */
export function appendFontOptionsToSelect(select, t, options = {}) {
  for (const group of getLocalizedFontFamilyGroups(t, options)) {
    const groupEl = document.createElement('optgroup');
    groupEl.label = group.group;
    for (const [optionValue, optionLabel] of group.options) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionLabel;
      groupEl.appendChild(option);
    }
    select.appendChild(groupEl);
  }
}

export function getLocalizedFontFamilyGroups(t, options = {}) {
  const includeInherit = options.includeInherit !== false;
  const groups = FONT_FAMILY_GROUPS.map((group) => ({
    group: t(group.group),
    options: group.options.map(([value, labelKey]) => [value, t(labelKey)]),
  }));

  if (includeInherit) return groups;

  /* 移除继承选项（空值）并重命名分组 */
  const inheritGroupIndex = groups.findIndex((g) => g.options.some(([value]) => value === ''));
  if (inheritGroupIndex >= 0) {
    groups[inheritGroupIndex] = {
      group: t('font.custom'),
      options: groups[inheritGroupIndex].options.filter(([value]) => value !== ''),
    };
  }

  return groups.filter((g) => g.options.length > 0);
}

const FONT_FAMILY_ITEM_PATTERN =
  "(?:var\\(\\s*--[a-zA-Z0-9_-]+\\s*\\)|'(?:[^'\\\\]|\\\\.)+'|[\\p{L}\\p{N}_-]+(?:\\s+[\\p{L}\\p{N}_-]+)*)";
const FONT_FAMILY_LIST_PATTERN = new RegExp(
  `^\\s*${FONT_FAMILY_ITEM_PATTERN}(?:\\s*,\\s*${FONT_FAMILY_ITEM_PATTERN})*\\s*$`,
  'u'
);

/*
 * 作用：
 * 判断某个字体值是否来自预设。
 */
export function isPresetFontValue(value) {
  const normalizedValue = normalizeFontFamilyInput(value);
  return FONT_FAMILY_OPTIONS.some(
    ([optionValue]) => normalizeFontFamilyInput(optionValue) === normalizedValue
  );
}

/*
 * 作用：
 * 规范化用户输入的 CSS font-family 字符串。
 */
export function normalizeFontFamilyInput(value) {
  return String(value || '').trim();
}

/*
 * 作用：
 * 校验用户输入是否像一个合法的 CSS font-family 列表。
 *
 * 支持：
 * - 单引号包裹的字体名（不接受双引号）
 * - 未加引号的字体名与通用字体族
 * - var(--font-*) 这类 Obsidian CSS 变量
 * - 逗号分隔的字体回退列表
 */
export function isValidFontFamilyInput(value) {
  const text = normalizeFontFamilyInput(value);
  if (!text) return true;
  return FONT_FAMILY_LIST_PATTERN.test(text);
}
