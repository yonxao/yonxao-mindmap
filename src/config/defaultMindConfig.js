/*
 * 文件作用：
 * 集中保存配置系统使用的默认值、枚举值和数值范围。
 *
 * 设计边界：
 * 这里只放“用户配置层”的默认值，不放布局算法常量、渲染几何常量或 CSS 样式值。
 * 这样配置 UI、解析归一化和运行时默认值可以共享同一来源。
 */

import {
  // 导图/源码幕布允许的最高用户配置高度，来自跨模块共享常量。
  CANVAS_MAX_HEIGHT as CONFIG_CANVAS_MAX_HEIGHT,
  // 导图/源码幕布允许的最低用户配置高度，来自跨模块共享常量。
  CANVAS_MIN_HEIGHT as CONFIG_CANVAS_MIN_HEIGHT,
  // 普通主题的默认最大宽度，来自布局共享常量。
  TOPIC_MAX_WIDTH,
} from '../constants.js';
import { DEFAULT_THEME_NAME } from '../theme/mindThemes.js';

// 配置面板和解析器共同使用的幕布高度下限。
export const CANVAS_MIN_HEIGHT = CONFIG_CANVAS_MIN_HEIGHT;
// 配置面板和解析器共同使用的幕布高度上限。
export const CANVAS_MAX_HEIGHT = CONFIG_CANVAS_MAX_HEIGHT;

// 全局/层级字号允许的最小值，单位为 px。
export const FONT_SIZE_MIN = 9;
// 全局/层级字号允许的最大值，单位为 px。
export const FONT_SIZE_MAX = 96;
// 全局/层级字重允许的最小值，对应 CSS font-weight。
export const FONT_WEIGHT_MIN = 100;
// 全局/层级字重允许的最大值，对应 CSS font-weight。
export const FONT_WEIGHT_MAX = 900;
// 全局/层级行高允许的最小值，单位为 px。
export const FONT_LINE_HEIGHT_MIN = 12;
// 全局/层级行高允许的最大值，单位为 px。
export const FONT_LINE_HEIGHT_MAX = 160;

// 主题最大宽度允许的最小值，防止节点过窄导致文字频繁换行。
export const TOPIC_MAX_WIDTH_MIN = 120;
// 主题最大宽度允许的最大值，防止节点过宽影响整体布局。
export const TOPIC_MAX_WIDTH_MAX = 800;

// 工具栏可吸附的幕布角落，顺序同时决定配置面板下拉顺序。
export const TOOLBAR_CORNERS = Object.freeze([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]);
// 工具栏相对幕布边框的位置，inside 为内侧，outside 为外侧。
export const TOOLBAR_PLACEMENTS = Object.freeze(['inside', 'outside']);

// 主题色系可选值，和 src/theme/mindThemes.js 中的主题名保持一致。
export const THEME_SCHEMES = Object.freeze([
  'default',
  'ocean',
  'forest',
  'sunset',
  'mono',
  'rainbow',
  'pastel-rainbow',
  'neon-rainbow',
]);

// 传统思维导图布局，可配置曲线/直线/折线连线。
export const MINDMAP_LAYOUT_TYPES = Object.freeze([
  'mindmap-right',
  'mindmap-left',
  'mindmap-bidirectional',
  'mindmap-up',
  'mindmap-down',
  'mindmap-vertical',
]);
// 树形布局，渲染语义固定为树状结构。
export const TREE_LAYOUT_TYPES = Object.freeze(['tree', 'tree-right', 'tree-left']);
// 组织结构图布局，渲染语义固定为组织结构。
export const ORG_LAYOUT_TYPES = Object.freeze(['org', 'org-right']);
// 时间轴布局，按时间线方向组织主题。
export const TIMELINE_LAYOUT_TYPES = Object.freeze(['timeline', 'timeline-up', 'timeline-down']);
// 放射布局，以中心主题向外环绕展开。
export const RADIAL_LAYOUT_TYPES = Object.freeze(['radial']);
// 鱼骨图布局，按左右骨架方向展开。
export const FISHBONE_LAYOUT_TYPES = Object.freeze(['fishbone-left', 'fishbone-right']);
// 表格树布局，按表格列/阶梯列展示层级。
export const TREE_TABLE_LAYOUT_TYPES = Object.freeze(['tree-table', 'tree-table-stepped']);

// 配置面板布局下拉的分组顺序和每组包含的布局值。
export const LAYOUT_OPTION_GROUPS = Object.freeze([
  Object.freeze({ group: 'mindmap', options: MINDMAP_LAYOUT_TYPES }),
  Object.freeze({ group: 'tree', options: TREE_LAYOUT_TYPES }),
  Object.freeze({ group: 'org', options: ORG_LAYOUT_TYPES }),
  Object.freeze({ group: 'timeline', options: TIMELINE_LAYOUT_TYPES }),
  Object.freeze({ group: 'radial', options: RADIAL_LAYOUT_TYPES }),
  Object.freeze({ group: 'fishbone', options: FISHBONE_LAYOUT_TYPES }),
  Object.freeze({ group: 'treeTable', options: TREE_TABLE_LAYOUT_TYPES }),
]);

// 所有合法布局值的扁平列表，用于配置归一化校验。
export const LAYOUT_TYPES = Object.freeze(
  LAYOUT_OPTION_GROUPS.flatMap((group) => Array.from(group.options))
);

// 传统思维导图支持的连线线型：曲线、直线、折线。
export const CONNECTOR_STYLES = Object.freeze(['curve', 'straight', 'elbow']);
// 普通主题的子主题展开方式：侧向展开或下挂展开。
export const BRANCH_EXPANSIONS = Object.freeze(['side', 'hanging']);

// 允许用户手动选择连线线型的布局集合。
export const CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS = MINDMAP_LAYOUT_TYPES;
// 不支持普通主题子主题展开方式配置的布局集合。
export const BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS = Object.freeze([
  ...RADIAL_LAYOUT_TYPES,
  ...TREE_TABLE_LAYOUT_TYPES,
]);

// 渲染器内部视图模式：导图模式或源码模式。
export const VIEW_MODES = Object.freeze(['map', 'source']);
// 打开导图时的初始缩放方式：原始大小或适配视图。
export const VIEW_FIT_MODES = Object.freeze(['original', 'fit']);
// 适配视图允许配置的最大放大倍数下限。
export const FIT_VIEW_MAX_SCALE_MIN = 1;
// 适配视图允许配置的最大放大倍数上限。
export const FIT_VIEW_MAX_SCALE_MAX = 6;

// 默认字体族，使用 Obsidian 当前主题正文变量。
export const DEFAULT_FONT_FAMILY = 'var(--font-text)';

/*
 * 作用：
 * 插件运行时使用的完整默认配置。
 *
 * 关键点：
 * 这个对象不是直接写回源码的模板，而是运行时兜底值。
 * 用户源码里没有写某个配置时，渲染器读取这里的默认值；保存时只写用户已有或插件主动记录的配置。
 */
export const DEFAULT_MIND_CONFIG = Object.freeze({
  // 导图幕布配置。
  canvas: Object.freeze({
    // null 表示使用自动高度，不把固定高度写入默认配置。
    height: null,
  }),
  // 工具栏位置配置。
  toolbar: Object.freeze({
    // 默认吸附在右上角，避开多数导图从左向右的主干起点。
    corner: 'top-right',
    // 默认放在幕布外侧，减少遮挡主题节点。
    placement: 'outside',
  }),
  // 交互配置。
  interaction: Object.freeze({
    // 默认不拦截滚轮缩放，避免影响 Obsidian 页面滚动。
    wheelZoom: false,
  }),
  // 视图配置。
  view: Object.freeze({
    // 默认进入导图模式，而不是源码模式。
    mode: 'map',
    // 默认打开时适配视图，尽量完整展示导图。
    fit: 'fit',
    // 默认适配视图不放大小图，避免少量主题被过度放大。
    fitNoUpscale: true,
    // 关闭“不放大”时，适配视图最多放大到 1.5 倍。
    fitMaxScale: 1.5,
  }),
  // 默认主题色系名称。
  theme: DEFAULT_THEME_NAME,
  // 默认布局为向右思维导图。
  layout: 'mindmap-right',
  // 连线配置。
  connector: Object.freeze({
    // 传统思维导图默认使用曲线连接。
    style: 'curve',
  }),
  // 普通主题分支配置。
  branch: Object.freeze({
    // 折线下的子主题默认侧向展开。
    expansion: 'side',
  }),
  // 字体配置。
  font: Object.freeze({
    // 默认继承 Obsidian 正文字体。
    family: DEFAULT_FONT_FAMILY,
    // 默认全局字号，单位为 px。
    size: 16,
    // 默认全局字重，400 为常规字重。
    weight: 400,
    // 默认全局行高，单位为 px。
    lineHeight: 20,
    // 默认没有任何层级字体覆盖。
    levels: Object.freeze({}),
  }),
  // 主题节点配置。
  topic: Object.freeze({
    // 空字符串表示不覆盖主题色，由当前主题色系决定。
    defaultColor: '',
    // 默认主题最大宽度，超过后按文本换行。
    maxWidth: TOPIC_MAX_WIDTH,
    // 默认没有任何层级主题宽度覆盖。
    levels: Object.freeze({}),
  }),
  // 源码模式配置。
  source: Object.freeze({
    // 默认允许 Tab/Shift+Tab 调整源码标题级别。
    enableTabIndent: true,
    // null 表示源码编辑区高度跟随自动高度。
    height: null,
  }),
});
