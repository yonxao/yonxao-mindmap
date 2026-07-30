export const RELATION_ANCHOR_NAMES = [
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const;

export type RelationAnchorName = (typeof RELATION_ANCHOR_NAMES)[number];

export interface Point {
  x: number;
  y: number;
}

export interface TopicLayoutBox extends Point {
  width: number;
  height: number;
}

export interface RelationAnchorPoint extends Point {
  name: RelationAnchorName;
}

export interface NearestRelationAnchor extends RelationAnchorPoint {
  distance: number;
}

export interface RelationAnchorAttributes {
  fromAnchor?: string | null;
  toAnchor?: string | null;
}

export interface ViewBoxSize {
  width: number;
  height: number;
}

// 普通主题卡片圆角为 8px；角锚点向内收缩后才落在实际描边上。
const TOPIC_CARD_CORNER_ANCHOR_INSET = 8;
const RADIAL_ANGLE_COMPONENT_EPSILON = 1e-9;

export function relationAnchorPoints(layout: TopicLayoutBox): RelationAnchorPoint[] {
  const left = layout.x - layout.width / 2;
  const right = layout.x + layout.width / 2;
  const top = layout.y - layout.height / 2;
  const bottom = layout.y + layout.height / 2;
  const cornerInset = Math.min(TOPIC_CARD_CORNER_ANCHOR_INSET, layout.width / 4, layout.height / 4);

  return [
    { name: 'top-left', x: left + cornerInset, y: top },
    { name: 'top', x: layout.x, y: top },
    { name: 'top-right', x: right - cornerInset, y: top },
    { name: 'left', x: left, y: layout.y },
    { name: 'right', x: right, y: layout.y },
    { name: 'bottom-left', x: left + cornerInset, y: bottom },
    { name: 'bottom', x: layout.x, y: bottom },
    { name: 'bottom-right', x: right - cornerInset, y: bottom },
  ];
}

export function relationAnchorPoint(
  layout: TopicLayoutBox,
  name: string | null | undefined
): RelationAnchorPoint | null {
  return relationAnchorPoints(layout).find((anchor) => anchor.name === name) || null;
}

export function nearestRelationAnchor(layout: TopicLayoutBox, point: Point): NearestRelationAnchor {
  return relationAnchorPoints(layout).reduce<NearestRelationAnchor | null>((nearest, anchor) => {
    const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
    return !nearest || distance < nearest.distance ? { ...anchor, distance } : nearest;
  }, null)!;
}

export function nearestRelationAnchorForAngle(
  layout: TopicLayoutBox,
  angle: number
): NearestRelationAnchor {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tx =
    Math.abs(dx) > RADIAL_ANGLE_COMPONENT_EPSILON ? layout.width / 2 / Math.abs(dx) : Infinity;
  const ty =
    Math.abs(dy) > RADIAL_ANGLE_COMPONENT_EPSILON ? layout.height / 2 / Math.abs(dy) : Infinity;
  const distance = Math.min(tx, ty);

  return nearestRelationAnchor(layout, {
    x: layout.x + dx * distance,
    y: layout.y + dy * distance,
  });
}

export function applyRelationAnchorEndpoints(
  points: readonly Point[],
  fromLayout: TopicLayoutBox,
  toLayout: TopicLayoutBox,
  attributes: RelationAnchorAttributes = {}
): Point[] {
  if (points.length < 2) return points as Point[];
  const anchored = points.map((point) => ({ ...point }));
  const fromAnchor = relationAnchorPoint(fromLayout, attributes.fromAnchor);
  const toAnchor = relationAnchorPoint(toLayout, attributes.toAnchor);
  if (fromAnchor) anchored[0] = { x: fromAnchor.x, y: fromAnchor.y };
  if (toAnchor) anchored[anchored.length - 1] = { x: toAnchor.x, y: toAnchor.y };
  return anchored;
}

export function relationControlMapUnitsPerPixel(
  viewBox: ViewBoxSize | null | undefined,
  viewportWidth: number,
  viewportHeight: number
): number {
  if (!viewBox || viewportWidth <= 0 || viewportHeight <= 0) return 1;
  return Math.max(viewBox.width / viewportWidth, viewBox.height / viewportHeight);
}
