import { CONNECTOR_AXIS_EPSILON, CURVE_BEND_RATIO, CURVE_MIN_BEND } from './renderConstants.js';

export type ConnectorStyle = 'curve' | 'straight' | 'elbow';
export type ConnectorAxis = 'x' | 'y';
export type ConnectorDirection = -1 | 1;
export type ConnectorKind =
  | 'tree-branch'
  | 'trunk-branch'
  | 'org'
  | 'org-right-subtopic'
  | 'timeline-detail'
  | 'hanging-horizontal'
  | 'hanging-vertical'
  | 'radial'
  | 'fishbone-primary-bone'
  | 'fishbone-rib-descendant'
  | 'fishbone-rib-topic'
  | 'skip';

export interface ConnectorAnchors {
  kind?: ConnectorKind;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  axis?: ConnectorAxis;
  sign?: ConnectorDirection;
}

export function axisLinePath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string | null {
  if (Math.abs(startY - endY) < CONNECTOR_AXIS_EPSILON) {
    return ['M', startX, startY, 'H', endX].join(' ');
  }

  if (Math.abs(startX - endX) < CONNECTOR_AXIS_EPSILON) {
    return ['M', startX, startY, 'V', endY].join(' ');
  }

  return null;
}

export function elbowPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  axis: ConnectorAxis = 'x'
): string {
  const linePath = axisLinePath(startX, startY, endX, endY);
  if (linePath) return linePath;

  if (axis === 'y') {
    const midY = startY + (endY - startY) / 2;
    return ['M', startX, startY, 'V', midY, 'H', endX, 'V', endY].join(' ');
  }

  const midX = startX + (endX - startX) / 2;
  return ['M', startX, startY, 'H', midX, 'V', endY, 'H', endX].join(' ');
}

export function hangingHorizontalPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  return (
    axisLinePath(startX, startY, endX, endY) ||
    ['M', startX, startY, 'V', endY, 'H', endX].join(' ')
  );
}

export function hangingVerticalPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  return (
    axisLinePath(startX, startY, endX, endY) ||
    ['M', startX, startY, 'H', endX, 'V', endY].join(' ')
  );
}

export function connectorPath(
  anchors: ConnectorAnchors,
  connectorStyle: ConnectorStyle = 'curve'
): string {
  const { kind, startX, startY, endX, endY } = anchors;
  const axis = anchors.axis === 'y' ? 'y' : 'x';
  const sign = anchors.sign || 1;

  if (kind === 'tree-branch' || kind === 'trunk-branch') {
    return axisLinePath(startX, startY, endX, startY) || '';
  }

  if (kind === 'org') {
    const midY = startY + (endY - startY) / 2;
    return (
      axisLinePath(startX, startY, endX, endY) ||
      ['M', startX, startY, 'V', midY, 'H', endX, 'V', endY].join(' ')
    );
  }

  if (
    kind === 'org-right-subtopic' ||
    kind === 'timeline-detail' ||
    kind === 'fishbone-rib-topic'
  ) {
    return axisLinePath(startX, startY, endX, startY) || '';
  }

  if (kind === 'hanging-horizontal') {
    return hangingHorizontalPath(startX, startY, endX, endY);
  }

  if (kind === 'hanging-vertical') {
    return hangingVerticalPath(startX, startY, endX, endY);
  }

  if (kind === 'radial' || kind === 'fishbone-primary-bone') {
    return ['M', startX, startY, 'L', endX, endY].join(' ');
  }

  if (kind === 'fishbone-rib-descendant') {
    const midX = startX + (endX - startX) / 2;
    return (
      axisLinePath(startX, startY, endX, endY) ||
      ['M', startX, startY, 'H', midX, 'V', endY, 'H', endX].join(' ')
    );
  }

  if (kind === 'skip') return '';

  if (connectorStyle === 'straight') {
    return ['M', startX, startY, 'L', endX, endY].join(' ');
  }

  if (connectorStyle === 'elbow') {
    return elbowPath(startX, startY, endX, endY, axis);
  }

  const bend = Math.max(
    CURVE_MIN_BEND,
    Math.abs(axis === 'y' ? endY - startY : endX - startX) * CURVE_BEND_RATIO
  );
  if (axis === 'y') {
    return [
      'M',
      startX,
      startY,
      'C',
      startX,
      startY + sign * bend,
      endX,
      endY - sign * bend,
      endX,
      endY,
    ].join(' ');
  }

  return [
    'M',
    startX,
    startY,
    'C',
    startX + sign * bend,
    startY,
    endX - sign * bend,
    endY,
    endX,
    endY,
  ].join(' ');
}
