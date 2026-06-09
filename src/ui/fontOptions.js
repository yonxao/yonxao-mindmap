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
 * - value: 实际写入配置区的 CSS font-family 字符串；空字符串表示删除配置并继承上级。
 * - label: 配置弹框里的显示文本。
 */
export const FONT_FAMILY_GROUPS = Object.freeze([
  {
    group: '继承与自定义',
    options: Object.freeze([
      ['', '继承上级字体'],
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
        '"Microsoft YaHei", "PingFang SC", "Source Han Sans SC", "Noto Sans CJK SC", sans-serif',
        '中文黑体',
      ],
      [
        '"SimSun", "Songti SC", "STSong", "Source Han Serif SC", "Noto Serif CJK SC", serif',
        '中文宋体',
      ],
      ['"KaiTi", "Kaiti SC", "STKaiti", "LXGW WenKai", cursive', '中文楷体'],
      ['"FangSong", "STFangsong", serif', '中文仿宋'],
      ['"Microsoft YaHei", "微软雅黑", sans-serif', '微软雅黑'],
      ['"PingFang SC", "苹方", sans-serif', '苹方'],
      ['"Source Han Sans SC", "Noto Sans CJK SC", sans-serif', '思源黑体'],
      ['"Source Han Serif SC", "Noto Serif CJK SC", serif', '思源宋体'],
      ['"LXGW WenKai", "霞鹜文楷", cursive', '霞鹜文楷'],
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
      ['"Sarasa Mono SC", "更纱黑体 Mono", monospace', '更纱黑体 Mono'],
      ['"JetBrains Mono", monospace', 'JetBrains Mono'],
      ['"Cascadia Mono", monospace', 'Cascadia Mono'],
    ]),
  },
]);

export const FONT_FAMILY_OPTIONS = Object.freeze(
  FONT_FAMILY_GROUPS.flatMap((group) => group.options)
);

/*
 * 作用：
 * 判断某个字体值是否来自预设。
 */
export function isPresetFontValue(value) {
  return FONT_FAMILY_OPTIONS.some(([optionValue]) => optionValue === value);
}
