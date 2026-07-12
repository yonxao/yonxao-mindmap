/*
 * 文件作用：
 * 集中管理所有 Lucide 图标名称常量，避免字符串字面量散落在各文件中。
 *
 * 命名规则：
 * ICON_{用途/语义}，值来自 Obsidian 内置的 Lucide 图标集。
 * 相同 Lucide 图标在不同上下文可能有不同语义常量，互不冲突。
 *
 * 使用方式：
 * import { ICON_CONFIG, ICON_FIT_VIEW } from '../icons/iconNames.js';
 *
 * 维护说明：
 * - 新增 UI 元素使用图标时，先在此文件添加常量，再在各文件中引用。
 * - 修改图标时只需改此文件一处。
 * - 分类按使用场景分组，每组加注释说明。
 */

// ─── 工具栏按钮 ───────────────────────────────────────────────
// 工具栏拖拽抓手
export const ICON_DRAG_HANDLE = 'move';

// 源码/导图切换
export const ICON_TOGGLE_SOURCE = 'code-2';
export const ICON_TOGGLE_MAP = 'brain-circuit';

// 打开配置
export const ICON_CONFIG = 'settings';

// 适配视图（最大化/还原）
export const ICON_FIT_VIEW = 'maximize';
export const ICON_ORIGINAL_SIZE = 'minimize';

// 窗口全屏（不使用物理全屏 API）
export const ICON_WINDOW_FULLSCREEN_ENTER = 'maximize-2';
export const ICON_WINDOW_FULLSCREEN_EXIT = 'minimize-2';

// 物理全屏（使用 Fullscreen API）
export const ICON_FULLSCREEN_ENTER = 'expand';
export const ICON_FULLSCREEN_EXIT = 'shrink';

// 缩放
export const ICON_ZOOM_IN = 'zoom-in';
export const ICON_ZOOM_OUT = 'zoom-out';

// 重置折叠状态
export const ICON_RESET_COLLAPSE = 'refresh-cw';

// ─── 右键菜单（主题） ─────────────────────────────────────────
export const ICON_EDIT_TOPIC = 'pencil';
export const ICON_TOPIC_EDIT_PANEL = 'sliders-horizontal';
export const ICON_COPY_CONTENT = 'copy';
export const ICON_COPY_SUBTREE = 'trees';
export const ICON_COPY_INDENTED = 'list-tree';
export const ICON_ADD_SUBTOPIC = 'circle-plus';
export const ICON_ADD_SIBLING_BEFORE = 'circle-arrow-out-up-right';
export const ICON_ADD_SIBLING_AFTER = 'circle-arrow-out-down-right';
export const ICON_COLLAPSE_TOGGLE = 'chevrons-down-up';
export const ICON_EXPAND_ALL = 'chevrons-left-right';
export const ICON_COLLAPSE_ALL = 'chevrons-right-left';
export const ICON_DELETE_TOPIC = 'trash-2';
// 高级结构类型图标，用于工具栏按钮、选中底栏和右键菜单。
export const ICON_RELATION = 'git-compare-arrows'; // 关联线：双向箭头表示主题间关系。
export const ICON_SUMMARY = 'braces'; // 概要：花括号轮廓表示包裹一组主题。
export const ICON_BOUNDARY = 'square-dashed'; // 外框：虚线方框表示圈定区域边界。
// 结构编辑模式操作按钮图标。
export const ICON_STRUCTURE_FINISH = 'check'; // 完成/确认当前结构选择。
export const ICON_STRUCTURE_CANCEL = 'x'; // 取消当前结构操作。

// ─── 右键菜单（地图空白） ─────────────────────────────────────
export const ICON_COPY_BODY = 'files';
export const ICON_COPY_INDENTED_BODY = 'list-tree';
export const ICON_COPY_SOURCE = 'file-code';
export const ICON_COPY_CONFIG = 'cog';
export const ICON_EXPORT_PNG = 'download';
export const ICON_COPY_PNG = 'images';
export const ICON_DELETE_MINDMAP = 'trash-2';

// ─── 主题编辑面板 ─────────────────────────────────────────────
// 编辑面板展开/收起按钮
export const ICON_EDITOR_EXPAND = 'maximize-2';

// ─── 配置面板 ─────────────────────────────────────────────────
// 配置项信息提示按钮
export const ICON_CONFIG_INFO = 'info';

// ─── 插件入口 ─────────────────────────────────────────────────
// Obsidian Ribbon 图标 / 编辑器菜单
export const ICON_PLUGIN_RIBBON = 'brain-circuit';
