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
export const TEXT_Y_CENTER_RATIO = 0.36;

export const TOPIC_CONTROL_SAFE_SIBLING_GAP = 19;
export const ORG_RIGHT_DESCENDANT_LEVEL_GAP = Math.round(LEVEL_GAP * 0.62);
export const ORG_RIGHT_DESCENDANT_SIBLING_GAP = Math.max(
  TOPIC_CONTROL_SAFE_SIBLING_GAP,
  Math.round(SIBLING_GAP * 0.56)
);
export const TREE_TRUNK_START_GAP = Math.max(22, Math.round(SIBLING_GAP * 1.25));
export const TREE_TRUNK_LEVEL_GAP = Math.max(28, Math.round(LEVEL_GAP * 0.36));
export const TREE_TRUNK_BRANCH_GAP = Math.max(12, Math.round(BRANCH_GAP * 0.42));
export const TREE_TRUNK_ORDER_GAP = Math.max(18, Math.round(SIBLING_GAP * 1.05));
export const TREE_DESCENDANT_LEVEL_GAP = Math.max(28, Math.round(LEVEL_GAP * 0.55));
export const TREE_DESCENDANT_SIBLING_GAP = Math.max(
  TOPIC_CONTROL_SAFE_SIBLING_GAP,
  Math.round(SIBLING_GAP * 0.72)
);
export const TREE_HANGING_SIBLING_GAP = Math.max(
  TOPIC_CONTROL_SAFE_SIBLING_GAP,
  Math.round(SIBLING_GAP * 0.78)
);
export const TIMELINE_DETAIL_LEVEL_GAP = Math.max(38, Math.round(LEVEL_GAP * 0.82));
export const TIMELINE_DETAIL_SIBLING_GAP = Math.max(
  TOPIC_CONTROL_SAFE_SIBLING_GAP,
  Math.round(SIBLING_GAP * 0.82)
);
export const TIMELINE_DETAIL_HANGING_SIBLING_GAP = Math.max(
  TIMELINE_DETAIL_SIBLING_GAP,
  Math.round(SIBLING_GAP * 1.12)
);
export const TIMELINE_AXIS_DETAIL_GAP = Math.max(20, Math.round(SIBLING_GAP * 1.05));
export const RADIAL_ROOT_RADIUS_MIN = 168;
export const RADIAL_ROOT_RADIUS_EXTRA = 72;
export const RADIAL_LEVEL_GAP = Math.round(LEVEL_GAP * 0.82);
export const RADIAL_SIBLING_GAP = Math.max(
  TOPIC_CONTROL_SAFE_SIBLING_GAP,
  Math.round(SIBLING_GAP * 0.9)
);
export const RADIAL_RADIUS_EXTRA_LIMIT = Math.round(LEVEL_GAP * 1.35);
export const RADIAL_COLLISION_MARGIN = 24;
export const RADIAL_COLLISION_ITERATIONS = 24;
export const HANGING_LEVEL_GAP = Math.round(LEVEL_GAP * 0.72);
export const HANGING_SIBLING_GAP = Math.max(TOPIC_CONTROL_SAFE_SIBLING_GAP, SIBLING_GAP);
export const HORIZONTAL_HANGING_EDGE_GAP = Math.max(24, Math.round(SIBLING_GAP * 1.35));
export const VERTICAL_HANGING_EDGE_GAP = Math.max(24, Math.round(SIBLING_GAP * 1.35));
export const FISHBONE_PRIMARY_BONE_ANGLE = Math.PI * 0.32;
export const FISHBONE_PRIMARY_BONE_SLOPE = Math.tan(FISHBONE_PRIMARY_BONE_ANGLE);
export const FISHBONE_PRIMARY_BONE_MIN_EDGE_OFFSET = Math.round(TOPIC_MIN_HEIGHT * 2.4);
export const HANGING_EXPANSION_LEVEL_THRESHOLD = 3;
