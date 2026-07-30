/*
 * 插件兼容出口：主题表和自动配色规则由公共核心维护。
 * 中文选项标签属于 Obsidian 配置面板文案，继续留在宿主层。
 */

export {
  DEFAULT_THEME_NAME,
  MIND_THEMES,
  MIND_THEME_NAMES,
  getMindTheme,
  normalizeMindThemeName,
  themeColorForTopic,
  themeConnectorOpacity,
  themeTopicFillAlpha,
} from '@yonxao/mindmap-core';

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
