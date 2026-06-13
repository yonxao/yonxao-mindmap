/*
 * 文件作用：
 * 这里集中定义 yonxao-mindmap 的内置主题。
 *
 * 设计思路：
 * - 主题只提供“默认视觉倾向”，不覆盖用户在主题属性里写的 [color=...]。
 * - 普通主题使用稳定的分支配色；彩虹主题会让一级分支自然分到不同颜色。
 * - 渲染器只关心“当前主题应该是什么颜色、透明度是多少”，不直接知道主题表细节。
 *
 * 调用链：
 * mindConfig.normalizeMindConfig() -> normalizeMindThemeName()
 * color.topicColor() -> themeColorForTopic()
 * YonxaoMindmapRenderer.renderTopic()/renderConnector() -> themeTopicFillAlpha()/themeConnectorOpacity()
 */

export const DEFAULT_THEME_NAME = 'default';

/*
 * 作用：
 * 主题选择列表。
 *
 * 关键点：
 * label 写中文是因为当前配置弹框主要面向中文使用者；README 中会同步英文说明。
 */
export const MIND_THEME_OPTIONS = Object.freeze([
  ['default', '默认：跟随 Obsidian'],
  ['ocean', '海洋：蓝青技术感'],
  ['forest', '森林：绿色学习感'],
  ['sunset', '日落：橙红创意感'],
  ['mono', '灰阶：正式文档'],
  ['rainbow', '彩虹：标准高饱和'],
  ['pastel-rainbow', '柔和彩虹：长期阅读'],
  ['neon-rainbow', '霓虹彩虹：深色展示'],
]);

/*
 * 作用：
 * 内置主题表。
 *
 * 字段说明：
 * - mode: 配色策略。none 不自动配色，single 使用单色，branch 按一级分支取色，level 按标题层级取色。
 * - centerColor: 中心主题默认颜色，让中心主题和支线有清晰区分。
 * - palette: 当前主题的颜色池。
 * - fillAlpha: 主题背景色透明度。
 * - connectorOpacity: 连线透明度。
 */
export const MIND_THEMES = Object.freeze({
  default: Object.freeze({
    mode: 'none',
    centerColor: '',
    palette: Object.freeze([]),
    fillAlpha: 0.11,
    connectorOpacity: 0.62,
  }),
  ocean: Object.freeze({
    mode: 'branch',
    centerColor: '#1d4ed8',
    palette: Object.freeze(['#2563eb', '#0ea5e9', '#06b6d4', '#14b8a6', '#6366f1']),
    fillAlpha: 0.12,
    connectorOpacity: 0.68,
  }),
  forest: Object.freeze({
    mode: 'branch',
    centerColor: '#15803d',
    palette: Object.freeze(['#16a34a', '#22c55e', '#059669', '#84cc16', '#0f766e']),
    fillAlpha: 0.12,
    connectorOpacity: 0.66,
  }),
  sunset: Object.freeze({
    mode: 'branch',
    centerColor: '#dc2626',
    palette: Object.freeze(['#f97316', '#ef4444', '#f59e0b', '#ec4899', '#a855f7']),
    fillAlpha: 0.13,
    connectorOpacity: 0.66,
  }),
  mono: Object.freeze({
    mode: 'level',
    centerColor: '#27272a',
    palette: Object.freeze(['#52525b', '#71717a', '#3f3f46', '#6b7280', '#475569']),
    fillAlpha: 0.09,
    connectorOpacity: 0.5,
  }),
  rainbow: Object.freeze({
    mode: 'branch',
    centerColor: '#2563eb',
    palette: Object.freeze([
      '#ef4444',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#06b6d4',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
    ]),
    fillAlpha: 0.12,
    connectorOpacity: 0.7,
  }),
  'pastel-rainbow': Object.freeze({
    mode: 'branch',
    centerColor: '#818cf8',
    palette: Object.freeze([
      '#f87171',
      '#fb923c',
      '#facc15',
      '#86efac',
      '#67e8f9',
      '#93c5fd',
      '#c4b5fd',
      '#f9a8d4',
    ]),
    fillAlpha: 0.1,
    connectorOpacity: 0.6,
  }),
  'neon-rainbow': Object.freeze({
    mode: 'branch',
    centerColor: '#00c7be',
    palette: Object.freeze([
      '#ff2d55',
      '#ff9f0a',
      '#ffd60a',
      '#32d74b',
      '#00c7be',
      '#0a84ff',
      '#bf5af2',
      '#ff375f',
    ]),
    fillAlpha: 0.14,
    connectorOpacity: 0.76,
  }),
});

/*
 * 作用：
 * 规范化主题名；未知主题统一回退到 default。
 */
export function normalizeMindThemeName(themeName) {
  const value = String(themeName || '')
    .trim()
    .toLowerCase();
  return Object.prototype.hasOwnProperty.call(MIND_THEMES, value) ? value : DEFAULT_THEME_NAME;
}

/*
 * 作用：
 * 根据配置读取当前主题对象。
 */
export function getMindTheme(config) {
  return MIND_THEMES[normalizeMindThemeName(config?.theme)] || MIND_THEMES[DEFAULT_THEME_NAME];
}

/*
 * 作用：
 * 根据当前主题和主题位置，计算主题自动颜色。
 *
 * 实现逻辑：
 * - branch 模式看主题 id 的一级分支序号，例如 0.2.1 属于第 2 个一级分支。
 * - level 模式看 主题级别标记层级，例如 #、##、###。
 * - single 模式始终使用 palette 的第一个颜色。
 */
export function themeColorForTopic(topic, config) {
  const theme = getMindTheme(config);
  if (isRootTopic(topic)) return theme.centerColor || '';
  if (!theme.palette.length || theme.mode === 'none') return '';

  if (theme.mode === 'single') return theme.palette[0];

  if (theme.mode === 'level') {
    return colorFromPalette(theme.palette, Math.max(0, Number(topic?.level || 1) - 1));
  }

  return colorFromPalette(theme.palette, rootBranchIndex(topic));
}

/*
 * 作用：
 * 读取主题背景透明度。
 */
export function themeTopicFillAlpha(config) {
  return getMindTheme(config).fillAlpha;
}

/*
 * 作用：
 * 读取连线透明度。
 */
export function themeConnectorOpacity(config) {
  return getMindTheme(config).connectorOpacity;
}

/*
 * 作用：
 * 从调色板中安全取色，超过长度时循环使用。
 */
function colorFromPalette(palette, index) {
  if (!palette.length) return '';
  return palette[Math.abs(index) % palette.length];
}

/*
 * 作用：
 * 计算主题所属的一级分支序号。
 *
 * 为什么根主题特殊处理：
 * 根主题 id 通常是 0，没有一级分支序号，默认使用调色板第一个颜色即可。
 */
function rootBranchIndex(topic) {
  const parts = String(topic?.id || '').split('.');
  if (parts.length < 2) return 0;

  const index = Number(parts[1]);
  return Number.isFinite(index) ? index : 0;
}

/*
 * 作用：
 * 判断当前主题是否是中心主题。
 */
function isRootTopic(topic) {
  return String(topic?.id || '') === '0' || Number(topic?.level || 1) <= 1;
}
