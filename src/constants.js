/*
 * 文件作用：
 * 这里集中保存插件跨模块共享的常量，例如代码块语言名、SVG 命名空间、布局尺寸和幕布高度范围。
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

// 项目文档和 GitHub 支持入口在配置面板多个位置复用，集中定义避免链接漂移。
export const PROJECT_REPOSITORY_URL = 'https://github.com/yonxao/yonxao-mindmap';
export const PROJECT_README_URL = `${PROJECT_REPOSITORY_URL}/blob/main/README.md`;
export const PROJECT_README_ZH_CN_URL = `${PROJECT_REPOSITORY_URL}/blob/main/README.zh-CN.md`;

// 水印条只裁剪导图内容层，不应覆盖编辑控件或其他 SVG 定义。
export const MAP_CONTENT_LAYER_ATTRIBUTE = 'data-yonxao-map-content-layer';

// 布局常量集中放在这里，后面做设置页时可以直接把这些值抽成用户配置。
export const LEVEL_GAP = 84;
export const SIBLING_GAP = 18;
export const BRANCH_GAP = 28;
export const TOPIC_PADDING_X = 16;
export const TOPIC_PADDING_Y = 10;
export const TOPIC_MIN_WIDTH = 92;
export const TOPIC_MAX_WIDTH = 240;
export const TOPIC_MIN_HEIGHT = 42;
export const LINE_HEIGHT = 18;
export const ICON_SIZE = 16;
export const ICON_GAP = 8;
export const VIEWBOX_MARGIN_X = 36;
export const VIEWBOX_MARGIN_Y = LINE_HEIGHT;
export const CANVAS_MIN_HEIGHT = 96;
export const CANVAS_MAX_HEIGHT = 1800;

// 工具栏按钮和视图控制快捷键共用同一组缩放倍率，避免两种入口的手感不一致。
export const ZOOM_IN_FACTOR = 0.82;
export const ZOOM_OUT_FACTOR = 1.18;
