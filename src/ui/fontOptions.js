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
    group: '继承与自定义',
    options: Object.freeze([
      ['', '继承全局字体'],
      [CUSTOM_FONT_VALUE, '自定义'],
    ]),
  },
  {
    group: 'Obsidian',
    options: Object.freeze([
      ['var(--font-interface)', 'Obsidian 界面字体'],
      ['var(--font-text)', 'Obsidian 正文字体'],
      ['var(--font-monospace)', 'Obsidian 等宽字体'],
    ]),
  },
  {
    group: '中文常用',
    options: Object.freeze([
      [
        "'Microsoft YaHei', 'PingFang SC', 'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif",
        '中文黑体',
      ],
      [
        "'SimSun', 'Songti SC', 'STSong', 'Source Han Serif SC', 'Noto Serif CJK SC', serif",
        '中文宋体',
      ],
      ["'KaiTi', 'Kaiti SC', 'STKaiti', 'LXGW WenKai', cursive", '中文楷体'],
      ["'FangSong', 'STFangsong', serif", '中文仿宋'],
      ["'Microsoft YaHei', '微软雅黑', sans-serif", '微软雅黑'],
      ["'PingFang SC', '苹方', sans-serif", '苹方'],
      ["'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif", '思源黑体'],
      ["'Source Han Serif SC', 'Noto Serif CJK SC', serif", '思源宋体'],
      ["'LXGW WenKai', '霞鹜文楷', cursive", '霞鹜文楷'],
    ]),
  },
  {
    group: '系统字体',
    options: Object.freeze([
      ['system-ui, sans-serif', '系统无衬线字体'],
      ['Georgia, "Times New Roman", serif', '系统衬线字体'],
      ['ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', '系统等宽字体'],
    ]),
  },
  {
    group: '等宽字体',
    options: Object.freeze([
      [
        "'Sarasa Mono SC', 'Noto Sans Mono CJK SC', 'Source Han Mono SC', 'Cascadia Mono', 'JetBrains Mono', 'Liberation Mono', monospace",
        '中文等宽字体栈',
      ],
      ["'Sarasa Mono SC', '更纱黑体 Mono', monospace", '更纱黑体 Mono'],
      ["'JetBrains Mono', monospace", 'JetBrains Mono'],
      ["'Cascadia Mono', monospace", 'Cascadia Mono'],
    ]),
  },
]);

export const FONT_FAMILY_OPTIONS = Object.freeze(
  FONT_FAMILY_GROUPS.flatMap((group) => group.options)
);

const FONT_FAMILY_ITEM_PATTERN =
  '(?:var\\(\\s*--[a-zA-Z0-9_-]+\\s*\\)|"(?:[^"\\\\]|\\\\.)+"|\'(?:[^\'\\\\]|\\\\.)+\'|[\\p{L}\\p{N}_-]+(?:\\s+[\\p{L}\\p{N}_-]+)*)';
const FONT_FAMILY_LIST_PATTERN = new RegExp(
  `^\\s*${FONT_FAMILY_ITEM_PATTERN}(?:\\s*,\\s*${FONT_FAMILY_ITEM_PATTERN})*\\s*$`,
  'u'
);

/*
 * 作用：
 * 根据当前语言生成字体下拉框选项。
 *
 * 为什么不直接修改 FONT_FAMILY_GROUPS：
 * FONT_FAMILY_GROUPS 保留为稳定的默认中文结构，方便旧调用方和测试读取；
 * 配置弹框实际显示时走这个函数，按当前插件语言替换 group 和 label。
 */
export function getLocalizedFontFamilyGroups(t, options = {}) {
  const includeInherit = options.includeInherit !== false;
  const groups = [
    {
      group: t('font.group.inherit'),
      options: [
        ['', t('font.inherit')],
        [CUSTOM_FONT_VALUE, t('font.custom')],
      ],
    },
    {
      group: t('font.group.obsidian'),
      options: [
        ['var(--font-interface)', t('font.obsidian.interface')],
        ['var(--font-text)', t('font.obsidian.text')],
        ['var(--font-monospace)', t('font.obsidian.monospace')],
      ],
    },
    {
      group: t('font.group.chinese'),
      options: [
        [
          "'Microsoft YaHei', 'PingFang SC', 'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif",
          t('font.chinese.sans'),
        ],
        [
          "'SimSun', 'Songti SC', 'STSong', 'Source Han Serif SC', 'Noto Serif CJK SC', serif",
          t('font.chinese.serif'),
        ],
        ["'KaiTi', 'Kaiti SC', 'STKaiti', 'LXGW WenKai', cursive", t('font.chinese.kaiti')],
        ["'FangSong', 'STFangsong', serif", t('font.chinese.fangsong')],
        ["'Microsoft YaHei', '微软雅黑', sans-serif", t('font.chinese.microsoftYaHei')],
        ["'PingFang SC', '苹方', sans-serif", t('font.chinese.pingFang')],
        ["'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif", t('font.chinese.sourceHanSans')],
        ["'Source Han Serif SC', 'Noto Serif CJK SC', serif", t('font.chinese.sourceHanSerif')],
        ["'LXGW WenKai', '霞鹜文楷', cursive", t('font.chinese.lxgwWenkai')],
      ],
    },
    {
      group: t('font.group.system'),
      options: [
        ['system-ui, sans-serif', t('font.system.sans')],
        ['Georgia, "Times New Roman", serif', t('font.system.serif')],
        ['ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', t('font.system.monospace')],
      ],
    },
    {
      group: t('font.group.monospace'),
      options: [
        [
          "'Sarasa Mono SC', 'Noto Sans Mono CJK SC', 'Source Han Mono SC', 'Cascadia Mono', 'JetBrains Mono', 'Liberation Mono', monospace",
          t('font.monospace.cjkStack'),
        ],
        ["'Sarasa Mono SC', '更纱黑体 Mono', monospace", t('font.monospace.sarasa')],
        ["'JetBrains Mono', monospace", t('font.monospace.jetbrains')],
        ["'Cascadia Mono', monospace", t('font.monospace.cascadia')],
      ],
    },
  ];

  return includeInherit
    ? groups
    : groups
        .map((group) =>
          group.group === t('font.group.inherit')
            ? { group: t('font.custom'), options: group.options.filter(([value]) => value !== '') }
            : group
        )
        .filter((group) => group.options.length > 0);
}

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
