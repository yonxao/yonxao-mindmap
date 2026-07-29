import { LINE_HEIGHT } from '@yonxao/mindmap-core';

// 连接线路径与圆头裁剪共用的稳定视觉基准。
export const CONNECTOR_STROKE_WIDTH = 2.2;
export const CONNECTOR_ROUND_CAP_EXTENSION = CONNECTOR_STROKE_WIDTH / 2;
export const CONNECTOR_AXIS_EPSILON = 0.5;
export const CURVE_MIN_BEND = 44;
export const CURVE_BEND_RATIO = 0.46;

// 主题控件点位冲突判断只依赖几何尺寸，不依赖具体宿主按钮。
export const TOPIC_TOGGLE_BUTTON_RADIUS = 8;
export const TOPIC_SIBLING_BUTTON_RADIUS = 8;
export const TOPIC_SUBTOPIC_BUTTON_RADIUS = 8;
export const TOPIC_CONTROL_AVOID_GAP = 3;
export const TOPIC_CONTROL_AVOID_OFFSET =
  TOPIC_TOGGLE_BUTTON_RADIUS + TOPIC_SIBLING_BUTTON_RADIUS + TOPIC_CONTROL_AVOID_GAP;
export const EDIT_BUTTON_SIZE = 20;

// 视口适配和缩放边界由所有宿主共用。
export const VIEWBOX_MARGIN_X = 36;
export const VIEWBOX_MARGIN_Y = LINE_HEIGHT;
export const VIEWBOX_MIN_DIMENSION = 80;
export const VIEWBOX_MAX_DIMENSION = 8000;
export const FOCUS_RATIO_BIAS_THRESHOLD = 1.25;
export const FOCUS_RATIO_BIASED = 0.32;
export const FOCUS_RATIO_CENTER = 0.5;

// 时间轴详情主干至少离开父主题少量距离，避免结构线贴边。
export const TIMELINE_MIN_TRUNK_X = 6;
