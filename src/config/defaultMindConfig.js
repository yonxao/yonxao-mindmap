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

// 主题最大宽度允许的最小值，防止主题过窄导致文字频繁换行。
export const TOPIC_MAX_WIDTH_MIN = 120;
// 主题最大宽度允许的最大值，允许长表格/代码等内容减少折行，同时仍保留硬上限。
export const TOPIC_MAX_WIDTH_MAX = 2000;

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

// 按钮配色模式可选值：inherit-accent 继承 Obsidian 强调色，subtle 为低调色，topic 为使用主题自身颜色，custom 为自定义颜色。
export const BUTTON_COLOR_MODES = Object.freeze(['inherit-accent', 'subtle', 'topic', 'custom']);
// 主题按钮显示方式：全部常显、折叠按钮常显其余悬浮、全部悬浮。
export const TOPIC_CONTROL_VISIBILITY_MODES = Object.freeze(['always', 'toggle-always', 'hover']);

// 当 Obsidian 主题变量或用户自定义颜色不可用时，按钮和颜色选择器使用的兜底蓝色。
export const DEFAULT_BUTTON_COLOR = '#3b82f6';
// 预定义的自定义按钮颜色选项，供配置面板使用。
export const BUTTON_COLOR_PRESETS = Object.freeze([
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  DEFAULT_BUTTON_COLOR,
  '#8b5cf6',
  '#ec4899',
  '#64748b',
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
export const FISHBONE_LAYOUT_TYPES = Object.freeze(['fishbone-right', 'fishbone-left']);
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
// 普通主题的子主题展开方式：自然展开或下挂展开。
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
// 字体下拉框中“自定义”选项的内部值，不会写入最终配置。
export const CUSTOM_FONT_VALUE = '__custom_font__';
// 主题普通文本对齐方式：auto 表示根据布局方向自动判断。
export const TEXT_ALIGN_VALUES = Object.freeze(['auto', 'left', 'center', 'right']);

// 水印配置元数据，同时供配置面板、序列化和运行时归一化使用。
export const WATERMARK_MODES = Object.freeze(['signature', 'normal']);
export const WATERMARK_SIGNATURE_STYLES = Object.freeze(['corner', 'bar']);
export const WATERMARK_TYPES = Object.freeze(['text', 'image']);
export const WATERMARK_ARRANGEMENTS = Object.freeze(['single', 'tiled']);
export const WATERMARK_IMAGE_SOURCE_TYPES = Object.freeze(['url', 'vault']);
export const WATERMARK_POSITIONS = Object.freeze([
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]);
export const WATERMARK_FONT_SIZE_MIN = 8;
export const WATERMARK_FONT_SIZE_MAX = 160;
export const WATERMARK_OPACITY_MIN = 0.01;
export const WATERMARK_OPACITY_MAX = 1;
export const WATERMARK_ROTATION_MIN = -180;
export const WATERMARK_ROTATION_MAX = 180;
export const WATERMARK_SIZE_MIN = 8;
export const WATERMARK_SIZE_MAX = 2000;
export const WATERMARK_GAP_MIN = 0;
export const WATERMARK_GAP_MAX = 2000;
export const WATERMARK_OFFSET_MIN = -2000;
export const WATERMARK_OFFSET_MAX = 2000;

// 规范化和 YAML 序列化共用字段顺序；新增水印字段时只需维护这里。
export const WATERMARK_SIGNATURE_CONFIG_KEYS = Object.freeze([
  'style',
  'text',
  'position',
  'color',
  'backgroundColor',
  'fontSize',
  'opacity',
  'barHeight',
  'padding',
]);
export const WATERMARK_NORMAL_CONFIG_KEYS = Object.freeze([
  'type',
  'arrangement',
  'position',
  'text',
  'imageSourceType',
  'imageSource',
  'color',
  'fontSize',
  'opacity',
  'rotation',
  'width',
  'height',
  'gapX',
  'gapY',
  'offsetX',
  'offsetY',
]);

/*
 * 可按主题级别覆盖的字体字段名。
 * 用于配置合并时按来源遮蔽全局默认值的 levelN 字段，
 * 以及配置面板中全局字段与级别字段的联动同步。
 */
export const FONT_LEVEL_FIELD_KEYS = Object.freeze(['family', 'size', 'weight', 'lineHeight']);

/*
 * 支持字体/主题最大宽度覆盖的主题级别 key。
 * 当前只支持 level1/level2/level3 三级覆盖，更深层级继承上级配置。
 */
export const FONT_LEVEL_KEYS = Object.freeze(['level1', 'level2', 'level3']);

// 主题最大宽度支持的级别 key，与字体级别保持一致。
export const TOPIC_MAX_WIDTH_LEVEL_KEYS = FONT_LEVEL_KEYS;

/*
 * 作用：
 * 按类型分组的字体下拉选项。
 *
 * 字段说明：
 * - group: 下拉框 optgroup 标题的 i18n key。
 * - options: 该组下的选项。
 * - value: 实际写入配置区的 CSS font-family 字符串；空字符串表示删除配置并继承全局字体。
 * - label: 配置面板里的显示文本 i18n key。
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
      ["'LXGW WenKai GB', 'LXGW WenKai', serif", 'font.chinese.lxgwWenkai'],
    ]),
  },

  {
    group: 'font.group.monospace',
    options: Object.freeze([
      [
        "'Sarasa Mono SC', 'Noto Sans Mono CJK SC', 'Source Han Mono SC', monospace",
        'font.monospace.cjkStack',
      ],
      ["'Sarasa Mono SC', 'Sarasa Fixed SC', monospace", 'font.monospace.sarasa'],
      ["'LXGW WenKai Mono', 'LXGW WenKai Mono GB', monospace", 'font.monospace.lxgwwenkai'],
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
 * 插件配置系统默认值，结构与 YAML 配置区一致。
 *
 * 关键点：
 * 这个对象直接映射到 canonicalizeMindConfig() 识别的规范分组，因此可以直接用于
 * "保存全部配置项"时补齐默认值，不再需要另一份规范结构等价形式。
 *
 * 使用场景：
 * - configNormalize.js 中 normalize 时作为字段级回退值
 * - configSerialize.js 中裁剪不活跃配置时作为有效默认值判断基准
 * - configModalState.js 中保存全部配置时补齐所有字段
 * - topicEditorState/TopicEditorPanel 中作为 placeholder 默认值
 *
 * 注意：
 * 渲染器运行时配置（normalized）的结构与这里不同（如 display.canvasHeight → canvas.height），
 * 但 DEFAULT_MIND_CONFIG 只负责"用户配置层"的默认值，运行时映射由 normalizeMindConfig 处理。
 */
export const DEFAULT_MIND_CONFIG = Object.freeze({
  display: Object.freeze({
    // null 表示使用自动高度，不把固定高度写入默认配置。
    canvasHeight: null,
    // null 表示源码编辑区高度跟随自动高度。
    sourceHeight: null,
    // 默认打开时适配视图，尽量完整展示导图。
    viewFit: 'fit',
    // 默认适配视图不放大小图，避免少量主题被过度放大。
    fitViewNoUpscale: true,
    // 关闭"不放大"时，适配视图最多放大到 1.5 倍。
    fitViewMaxScale: 1.5,
    // 默认裁剪保存，只写非默认值的配置项；开启后写入全部配置，便于分享。
    saveFullConfig: false,
  }),
  structure: Object.freeze({
    // 默认布局为向右思维导图。
    layout: 'mindmap-right',
    // 传统思维导图默认使用曲线连接。
    connectorStyle: 'curve',
    // 折线下的子主题默认自然展开。
    branchExpansion: 'side',
    topicMaxWidth: Object.freeze({
      // 默认主题最大宽度，超过后按文本换行。
      global: TOPIC_MAX_WIDTH,
    }),
  }),
  color: Object.freeze({
    // 默认主题色系名称。
    scheme: DEFAULT_THEME_NAME,
    // 空字符串表示不覆盖主题色，由当前主题色系决定。
    defaultTopicColor: '',
    // 默认使用继承 Obsidian 强调色作为按钮颜色。
    buttonColorMode: 'inherit-accent',
    // 自定义按钮颜色，仅在 buttonColorMode 为 custom 时生效。
    buttonColor: '',
    advancedStructure: Object.freeze({
      // 关联、概要和外框使用不同默认色，便于快速区分结构语义。
      // 蓝灰色调用于关联线（连接两个独立主题）、紫灰色调用于概要（包裹一组主题）、
      // 青灰色调用于外框（圈定区域），三种颜色在视觉上有明显区分但不刺眼。
      relation: '#526b8a',
      summary: '#705b8f',
      boundary: '#477970',
    }),
  }),
  font: Object.freeze({
    // 默认继承 Obsidian 正文字体。
    family: DEFAULT_FONT_FAMILY,
    // 默认全局字号，单位为 px。
    size: 16,
    // 默认全局字重，400 为常规字重。
    weight: 400,
    // 默认全局行高，单位为 px。
    lineHeight: 20,
    // 默认按布局方向自动决定普通文本对齐。
    align: 'auto',
  }),
  interaction: Object.freeze({
    toolbar: Object.freeze({
      // 默认吸附在右上角，避开多数导图从左向右的主干起点。
      corner: 'top-right',
      // 默认放在幕布外侧，减少遮挡主题。
      placement: 'outside',
    }),
    // 默认保留折叠按钮常显，其余编辑/新增按钮在主题悬浮时显示。
    topicControlVisibility: 'toggle-always',
    // 默认允许 Tab/Shift+Tab 调整源码主题级别。
    tabIndent: true,
    // 默认不拦截滚轮缩放，避免影响 Obsidian 页面滚动。
    wheelZoom: false,
  }),
  watermark: Object.freeze({
    // 水印是可选扩展功能，默认不改变任何现有导图。
    enabled: false,
    mode: 'signature',
    signature: Object.freeze({
      style: 'corner',
      text: 'Made with Yonxao Mind Map',
      position: 'bottom-right',
      color: '#64748b',
      // 自定义背景默认透明；水印条仍由渲染层叠加低透明度强调底。
      backgroundColor: 'transparent',
      fontSize: 14,
      opacity: 0.7,
      barHeight: 36,
      padding: 16,
    }),
    normal: Object.freeze({
      type: 'text',
      arrangement: 'tiled',
      position: 'center',
      text: '© Yonxao',
      imageSourceType: 'url',
      imageSource: '',
      color: '#64748b',
      fontSize: 24,
      opacity: 0.18,
      rotation: -30,
      width: 160,
      height: 80,
      gapX: 120,
      gapY: 100,
      offsetX: 0,
      offsetY: 0,
    }),
  }),
});
