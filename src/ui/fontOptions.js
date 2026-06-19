/*
 * 文件作用：
 * 这里集中维护配置弹框里可选择的字体预设。
 *
 * 设计思路：
 * Obsidian 插件运行在浏览器/Electron 环境中，不能可靠读取完整系统字体列表。
 * 因此这里提供一组常见字体和 CSS 字体栈；用户也可以选择“自定义”后手动输入。
 *
 * 调用链：
 * ConfigModal.renderFontTab()/createLevelFontGroup() -> FONT_FAMILY_GROUPS。
 */

export const CUSTOM_FONT_VALUE = '__custom_font__';

/*
 * 作用：
 * 按类型分组的字体下拉选项。
 *
 * 字段说明：
 * - group: 下拉框 optgroup 标题。
 * - options: 该组下的选项。
 * - value: 实际写入配置区的 CSS font-family 字符串；空字符串表示删除配置并继承全局字体。
 * - label: 配置弹框里的显示文本。
 */
export const FONT_FAMILY_GROUPS = Object.freeze([
  {
    group: 'font.group.inherit',
    options: Object.freeze([
      ['', 'font.inherit'],
      [CUSTOM_FONT_VALUE, 'font.custom'],
    ]),
  },

  {
    group: 'font.group.obsidian',
    options: Object.freeze([
      ['var(--font-interface)', 'font.obsidian.interface'],
      ['var(--font-text)', 'font.obsidian.text'],
      ['var(--font-monospace)', 'font.obsidian.monospace'],
    ]),
  },

  {
    group: 'font.group.system',
    options: Object.freeze([
      ['system-ui, sans-serif', 'font.system.sans'],
      ['ui-serif, serif', 'font.system.serif'],
      ['ui-monospace, monospace', 'font.system.monospace'],
    ]),
  },

  {
    group: 'font.group.chinese',
    options: Object.freeze([
      [
        "'Microsoft YaHei', 'PingFang SC', 'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif",
        'font.chinese.sans',
      ],
      [
        "'SimSun', 'Songti SC', 'STSong', 'Source Han Serif SC', 'Noto Serif CJK SC', serif",
        'font.chinese.serif',
      ],
      ["'KaiTi', 'Kaiti SC', 'STKaiti', 'LXGW WenKai', serif", 'font.chinese.kaiti'],
      ["'FangSong', 'STFangsong', serif", 'font.chinese.fangsong'],
      ["'Microsoft YaHei', '微软雅黑', sans-serif", 'font.chinese.microsoftYaHei'],
      ["'PingFang SC', '苹方', sans-serif", 'font.chinese.pingFang'],
      ["'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif", 'font.chinese.sourceHanSans'],
      ["'Source Han Serif SC', 'Noto Serif CJK SC', serif", 'font.chinese.sourceHanSerif'],
      [
        "'LXGW WenKai GB', '霞鹜文楷 GB', 'LXGW WenKai', '霞鹜文楷', serif",
        'font.chinese.lxgwWenkai',
      ],
    ]),
  },

  {
    group: 'font.group.monospace',
    options: Object.freeze([
      [
        "'Sarasa Mono SC', 'Noto Sans Mono CJK SC', 'Source Han Mono SC', monospace",
        'font.monospace.cjkStack',
      ],
      [
        "'Sarasa Mono SC', 'Sarasa Fixed SC','等距更纱黑体 SC','更纱黑体 Mono', monospace",
        'font.monospace.sarasa',
      ],
      [
        "'LXGW WenKai Mono', '霞鹜文楷等宽','LXGW WenKai Mono GB','霞鹜文楷等宽 GB', monospace",
        'font.monospace.lxgwwenkai',
      ],
      ["'JetBrains Mono', monospace", 'font.monospace.jetbrains'],
      ["'Cascadia Mono', monospace", 'font.monospace.cascadia'],
    ]),
  },
]);

export const FONT_FAMILY_OPTIONS = Object.freeze(
  FONT_FAMILY_GROUPS.flatMap((group) => group.options)
);

/*
 * 作用：
 * 根据当前语言生成字体下拉框选项。
 *
 * 实现逻辑：
 * FONT_FAMILY_GROUPS 的标签存储为 i18n key，这里通过 t() 翻译。
 */
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
  '(?:var\\(\\s*--[a-zA-Z0-9_-]+\\s*\\)|"(?:[^"\\\\]|\\\\.)+"|\'(?:[^\'\\\\]|\\\\.)+\'|[\\p{L}\\p{N}_-]+(?:\\s+[\\p{L}\\p{N}_-]+)*)';
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
  return String(value || '')
    .trim()
    .replace(/"((?:[^"\\]|\\.)*)"/g, (_match, fontName) => {
      const normalizedName = fontName.replace(/\\"/g, '"').replace(/\\'/g, "'");
      return `'${normalizedName.replace(/'/g, "\\'")}'`;
    });
}

/*
 * 作用：
 * 校验用户输入是否像一个合法的 CSS font-family 列表。
 *
 * 支持：
 * - 双引号/单引号包裹的字体名
 * - 未加引号的字体名与通用字体族
 * - var(--font-*) 这类 Obsidian CSS 变量
 * - 逗号分隔的字体回退列表
 */
export function isValidFontFamilyInput(value) {
  const text = normalizeFontFamilyInput(value);
  if (!text) return true;
  return FONT_FAMILY_LIST_PATTERN.test(text);
}
