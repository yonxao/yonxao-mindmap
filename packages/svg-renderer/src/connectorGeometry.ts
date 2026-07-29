import {
  TOPIC_PADDING_X,
  nearestRelationAnchorForAngle,
  type LayoutBox,
  type Point,
} from '@yonxao/mindmap-core';
import { CONNECTOR_ROUND_CAP_EXTENSION, TIMELINE_MIN_TRUNK_X } from './renderConstants.js';
import type { ConnectorAnchors, ConnectorStyle } from './connectorPaths.js';

export interface ConnectorLayoutBox extends LayoutBox {
  radialAngle?: number;
}

export function normalizedVector(dx: number, dy: number): Point | null {
  const length = Math.hypot(dx, dy);
  if (length <= Number.EPSILON) return null;
  return { x: dx / length, y: dy / length };
}

export function trimConnectorAlongVectors<T extends ConnectorAnchors>(
  anchors: T,
  startDx: number,
  startDy: number,
  endDx: number,
  endDy: number,
  offset: number
): T {
  const startVector = normalizedVector(startDx, startDy);
  const endVector = normalizedVector(endDx, endDy);
  if (!startVector || !endVector) return anchors;

  return {
    ...anchors,
    startX: anchors.startX + startVector.x * offset,
    startY: anchors.startY + startVector.y * offset,
    endX: anchors.endX - endVector.x * offset,
    endY: anchors.endY - endVector.y * offset,
  };
}

export function trimConnectorAnchors<T extends ConnectorAnchors>(
  anchors: T | null | undefined,
  connectorStyle: ConnectorStyle = 'curve',
  offset = CONNECTOR_ROUND_CAP_EXTENSION
): T | null | undefined {
  if (!anchors || anchors.kind === 'skip' || offset <= 0) return anchors;

  if (anchors.kind === 'radial' || anchors.kind === 'fishbone-primary-bone') {
    return trimConnectorAlongVectors(
      anchors,
      anchors.endX - anchors.startX,
      anchors.endY - anchors.startY,
      anchors.endX - anchors.startX,
      anchors.endY - anchors.startY,
      offset
    );
  }

  if (anchors.kind === 'hanging-horizontal') {
    return trimConnectorAlongVectors(
      anchors,
      0,
      anchors.endY - anchors.startY,
      anchors.endX - anchors.startX,
      0,
      offset
    );
  }

  if (anchors.kind === 'hanging-vertical') {
    return trimConnectorAlongVectors(
      anchors,
      anchors.endX - anchors.startX,
      0,
      0,
      anchors.endY - anchors.startY,
      offset
    );
  }

  if (anchors.kind === 'org') {
    return trimConnectorAlongVectors(
      anchors,
      0,
      anchors.endY - anchors.startY,
      0,
      anchors.endY - anchors.startY,
      offset
    );
  }

  if (
    anchors.kind === 'tree-branch' ||
    anchors.kind === 'trunk-branch' ||
    anchors.kind === 'org-right-subtopic' ||
    anchors.kind === 'timeline-detail' ||
    anchors.kind === 'fishbone-rib-topic' ||
    anchors.kind === 'fishbone-rib-descendant'
  ) {
    return trimConnectorAlongVectors(
      anchors,
      anchors.endX - anchors.startX,
      0,
      anchors.endX - anchors.startX,
      0,
      offset
    );
  }

  if (connectorStyle === 'straight') {
    return trimConnectorAlongVectors(
      anchors,
      anchors.endX - anchors.startX,
      anchors.endY - anchors.startY,
      anchors.endX - anchors.startX,
      anchors.endY - anchors.startY,
      offset
    );
  }

  const axis = anchors.axis === 'y' ? 'y' : 'x';
  const sign = anchors.sign || 1;
  return trimConnectorAlongVectors(
    anchors,
    axis === 'y' ? 0 : sign,
    axis === 'y' ? sign : 0,
    axis === 'y' ? 0 : sign,
    axis === 'y' ? sign : 0,
    offset
  );
}

export function connectorBendPoint(anchors: ConnectorAnchors): Point | null {
  const { kind, startX, startY, endX, endY } = anchors;

  if (kind === 'hanging-horizontal') return { x: startX, y: endY };
  if (kind === 'hanging-vertical') return { x: endX, y: startY };
  if (kind === 'fishbone-rib-descendant') {
    return { x: (startX + endX) / 2, y: endY };
  }
  if (kind === 'org') return { x: endX, y: (startY + endY) / 2 };
  return null;
}

export function radialConnectorPoint(box: LayoutBox, angle: number): Point {
  const anchor = nearestRelationAnchorForAngle(box, angle);
  return { x: anchor.x, y: anchor.y };
}

export function timelineDetailBranchX(
  parentBox: LayoutBox,
  subtopicBoxes: readonly LayoutBox[] = []
): number {
  if (parentBox.side !== 'timeline-detail-top' && parentBox.side !== 'timeline-detail-bottom') {
    return parentBox.x;
  }

  const parentRight = parentBox.x + parentBox.width / 2;
  const preferredX = parentRight + TOPIC_PADDING_X;
  if (!subtopicBoxes.length) return preferredX;

  const firstSubtopicLeft = Math.min(...subtopicBoxes.map((box) => box.x - box.width / 2));
  const available = firstSubtopicLeft - parentRight;
  if (available <= TOPIC_PADDING_X) {
    return parentRight + Math.max(TIMELINE_MIN_TRUNK_X, available / 2);
  }

  return Math.min(preferredX, firstSubtopicLeft - TOPIC_PADDING_X / 2);
}

export function orgRightBranchX(parentBox: LayoutBox): number {
  return parentBox.x;
}

export function connectorAnchors(
  parentBox: ConnectorLayoutBox,
  subtopicBox: ConnectorLayoutBox
): ConnectorAnchors {
  const side = subtopicBox.side;

  if (subtopicBox.branchExpansion === 'hanging') {
    if (side === 'top' || side === 'bottom') {
      const direction = side === 'top' ? -1 : 1;
      const horizontalDirection = subtopicBox.x < parentBox.x ? -1 : 1;
      return {
        kind: 'hanging-vertical',
        startX: parentBox.x + horizontalDirection * (parentBox.width / 2),
        startY: parentBox.y,
        endX: subtopicBox.x,
        endY: subtopicBox.y - direction * (subtopicBox.height / 2),
      };
    }

    const direction =
      side === 'left' || side === 'tree-left' || subtopicBox.fishboneDirection === -1 ? -1 : 1;
    return {
      kind: 'hanging-horizontal',
      startX: parentBox.x,
      startY: parentBox.y + parentBox.height / 2,
      endX: subtopicBox.x - direction * (subtopicBox.width / 2),
      endY: subtopicBox.y,
    };
  }

  if (parentBox.side === 'root' && (side === 'tree-left' || side === 'tree-right')) {
    return {
      kind: 'tree-branch',
      startX: parentBox.x,
      startY: subtopicBox.y,
      endX:
        side === 'tree-left'
          ? subtopicBox.x + subtopicBox.width / 2
          : subtopicBox.x - subtopicBox.width / 2,
      endY: subtopicBox.y,
    };
  }

  if (parentBox.side === 'root' && side === 'org-right') {
    return {
      kind: 'trunk-branch',
      startX: parentBox.x,
      startY: subtopicBox.y,
      endX: subtopicBox.x - subtopicBox.width / 2,
      endY: subtopicBox.y,
    };
  }

  if (parentBox.side === 'root' && side === 'org-right-branch') {
    return {
      kind: 'org',
      startX: parentBox.x,
      startY: parentBox.y + parentBox.height / 2,
      endX: subtopicBox.x,
      endY: subtopicBox.y - subtopicBox.height / 2,
    };
  }

  if (parentBox.side === 'root' && side === 'timeline-point') {
    return {
      kind: 'skip',
      startX: subtopicBox.x,
      startY: subtopicBox.y,
      endX: subtopicBox.x,
      endY: subtopicBox.y,
    };
  }

  if (parentBox.side === 'root' && (side === 'fishbone-top' || side === 'fishbone-bottom')) {
    return {
      kind: 'fishbone-primary-bone',
      startX: subtopicBox.fishboneMainSpineAttachX!,
      startY: parentBox.y,
      endX: subtopicBox.x,
      endY:
        side === 'fishbone-top'
          ? subtopicBox.y + subtopicBox.height / 2
          : subtopicBox.y - subtopicBox.height / 2,
    };
  }

  if (typeof subtopicBox.radialAngle === 'number' && Number.isFinite(subtopicBox.radialAngle)) {
    const start = radialConnectorPoint(parentBox, subtopicBox.radialAngle);
    const end = radialConnectorPoint(subtopicBox, subtopicBox.radialAngle + Math.PI);
    return {
      kind: 'radial',
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
    };
  }

  if (side === 'fishbone-rib-descendant') {
    const direction = subtopicBox.fishboneDirection || 1;
    return {
      kind: 'fishbone-rib-descendant',
      startX: parentBox.x + direction * (parentBox.width / 2),
      startY: parentBox.y,
      endX: subtopicBox.x - direction * (subtopicBox.width / 2),
      endY: subtopicBox.y,
    };
  }

  if (side === 'fishbone-rib-topic') {
    const direction = subtopicBox.fishboneDirection || 1;
    return {
      kind: 'fishbone-rib-topic',
      startX: subtopicBox.fishboneDiagonalBoneAttachX!,
      startY: subtopicBox.fishboneDiagonalBoneAttachY!,
      endX: subtopicBox.x - direction * (subtopicBox.width / 2),
      endY: subtopicBox.y,
    };
  }

  if (side === 'timeline-detail-top' || side === 'timeline-detail-bottom') {
    if (subtopicBox.branchExpansion === 'side') {
      return {
        startX: parentBox.x + parentBox.width / 2,
        startY: parentBox.y,
        endX: subtopicBox.x - subtopicBox.width / 2,
        endY: subtopicBox.y,
        axis: 'x',
        sign: 1,
      };
    }

    return {
      kind: 'timeline-detail',
      startX: timelineDetailBranchX(parentBox, [subtopicBox]),
      startY: subtopicBox.y,
      endX: subtopicBox.x - subtopicBox.width / 2,
      endY: subtopicBox.y,
    };
  }

  if (side === 'org-bottom') {
    return {
      kind: 'org',
      startX: parentBox.x,
      startY: parentBox.y + parentBox.height / 2,
      endX: subtopicBox.x,
      endY: subtopicBox.y - subtopicBox.height / 2,
    };
  }

  if (side === 'org-hanging') {
    return {
      kind: 'hanging-horizontal',
      startX: parentBox.x,
      startY: parentBox.y + parentBox.height / 2,
      endX: subtopicBox.x - subtopicBox.width / 2,
      endY: subtopicBox.y,
    };
  }

  if (side === 'org-right') {
    if (subtopicBox.branchExpansion === 'side') {
      return {
        startX: parentBox.x + parentBox.width / 2,
        startY: parentBox.y,
        endX: subtopicBox.x - subtopicBox.width / 2,
        endY: subtopicBox.y,
        axis: 'x',
        sign: 1,
      };
    }

    return {
      kind: 'org-right-subtopic',
      startX: orgRightBranchX(parentBox),
      startY: subtopicBox.y,
      endX: subtopicBox.x - subtopicBox.width / 2,
      endY: subtopicBox.y,
    };
  }

  if (side === 'left' || side === 'tree-left') {
    return {
      startX: parentBox.x - parentBox.width / 2,
      startY: parentBox.y,
      endX: subtopicBox.x + subtopicBox.width / 2,
      endY: subtopicBox.y,
      axis: 'x',
      sign: -1,
    };
  }

  if (side === 'top') {
    return {
      startX: parentBox.x,
      startY: parentBox.y - parentBox.height / 2,
      endX: subtopicBox.x,
      endY: subtopicBox.y + subtopicBox.height / 2,
      axis: 'y',
      sign: -1,
    };
  }

  if (side === 'bottom') {
    return {
      startX: parentBox.x,
      startY: parentBox.y + parentBox.height / 2,
      endX: subtopicBox.x,
      endY: subtopicBox.y - subtopicBox.height / 2,
      axis: 'y',
      sign: 1,
    };
  }

  return {
    startX: parentBox.x + parentBox.width / 2,
    startY: parentBox.y,
    endX: subtopicBox.x - subtopicBox.width / 2,
    endY: subtopicBox.y,
    axis: 'x',
    sign: 1,
  };
}
