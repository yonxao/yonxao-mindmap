import type { TopicLayoutBox } from '@yonxao/mindmap-core';
import {
  TOPIC_CONTROL_AVOID_GAP,
  TOPIC_SIBLING_BUTTON_RADIUS,
  TOPIC_TOGGLE_BUTTON_RADIUS,
} from './renderConstants.js';

export type TopicBorderSide = 'left' | 'right' | 'top' | 'bottom';

export interface TopicBorderPoint {
  side: TopicBorderSide;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function topicBorderPoint(box: Size, side: TopicBorderSide): TopicBorderPoint {
  if (side === 'left') return { side, x: 0, y: box.height / 2 };
  if (side === 'right') return { side, x: box.width, y: box.height / 2 };
  if (side === 'top') return { side, x: box.width / 2, y: 0 };
  return { side: 'bottom', x: box.width / 2, y: box.height };
}

export function globalPointToTopicPoint(
  box: TopicLayoutBox,
  x: number,
  y: number
): TopicBorderPoint {
  const localX = x - (box.x - box.width / 2);
  const localY = y - (box.y - box.height / 2);
  return projectTopicPointToBorder(box, localX, localY);
}

export function projectTopicPointToBorder(box: Size, x: number, y: number): TopicBorderPoint {
  const side = nearestTopicBorderSide(box, x, y);
  if (side === 'left') return { side, x: 0, y: clamp(y, 0, box.height) };
  if (side === 'right') return { side, x: box.width, y: clamp(y, 0, box.height) };
  if (side === 'top') return { side, x: clamp(x, 0, box.width), y: 0 };
  return { side: 'bottom', x: clamp(x, 0, box.width), y: box.height };
}

export function nearestTopicBorderSide(box: Size, x: number, y: number): TopicBorderSide {
  const distances: Array<{ side: TopicBorderSide; distance: number }> = [
    { side: 'left', distance: Math.abs(x) },
    { side: 'right', distance: Math.abs(box.width - x) },
    { side: 'top', distance: Math.abs(y) },
    { side: 'bottom', distance: Math.abs(box.height - y) },
  ];
  distances.sort((a, b) => a.distance - b.distance);
  return distances[0]!.side;
}

export function oppositeTopicSide(side: TopicBorderSide): TopicBorderSide {
  if (side === 'left') return 'right';
  if (side === 'right') return 'left';
  if (side === 'top') return 'bottom';
  return 'top';
}

export function pointToButtonPosition<T extends TopicBorderPoint>(point: T, size: Size): T {
  return {
    ...point,
    x: point.x - size.width / 2,
    y: point.y - size.height / 2,
  };
}

export function sameTopicControlPoint(
  a: TopicBorderPoint | null | undefined,
  b: TopicBorderPoint | null | undefined
): boolean {
  return Boolean(a && b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5);
}

export function topicControlPointsConflict(
  a: TopicBorderPoint | null | undefined,
  b: TopicBorderPoint | null | undefined
): boolean {
  if (!a || !b) return false;
  if (sameTopicControlPoint(a, b)) return true;
  const minDistance =
    TOPIC_SIBLING_BUTTON_RADIUS + TOPIC_TOGGLE_BUTTON_RADIUS + TOPIC_CONTROL_AVOID_GAP;
  return Math.hypot(a.x - b.x, a.y - b.y) < minDistance;
}
