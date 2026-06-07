/*
 * 文件作用：
 * 这里集中保存插件跨模块共享的常量，例如代码块语言名、SVG 命名空间、布局尺寸和画布高度范围。
 *
 * 设计思路：
 * 常量集中管理可以避免“魔法数字”散落在渲染器、布局器和源码编辑器里。
 * 后续如果要做设置页，这些默认值也最容易从这里抽成用户配置。
 *
 * 调用链位置：
 * renderer/layout/icons/svg 等模块都会从这里读取配置值，不直接修改这里的值。
 */

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const CODE_BLOCK_NAME = 'yxmm';

// 布局常量集中放在这里，后面做设置页时可以直接把这些值抽成用户配置。
export const LEVEL_GAP = 84;
export const SIBLING_GAP = 18;
export const BRANCH_GAP = 28;
export const NODE_PADDING_X = 16;
export const NODE_PADDING_Y = 10;
export const NODE_MIN_WIDTH = 92;
export const NODE_MAX_WIDTH = 240;
export const NODE_MIN_HEIGHT = 42;
export const LINE_HEIGHT = 18;
export const ICON_SIZE = 16;
export const ICON_GAP = 8;
export const VIEWBOX_MARGIN_X = 36;
export const VIEWBOX_MARGIN_Y = LINE_HEIGHT;
export const CANVAS_MIN_HEIGHT = 96;
export const CANVAS_MAX_HEIGHT = 1800;
