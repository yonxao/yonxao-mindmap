export type LayoutSide = 'left' | 'right' | 'top' | 'bottom';
export type TreeLayoutSide = 'tree-left' | 'tree-right';
export type TimelineBranchSide = 'timeline-top' | 'timeline-bottom';
export type FishboneDirection = -1 | 1;

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutBox extends LayoutPoint {
  width: number;
  height: number;
  side?:
    | LayoutSide
    | TreeLayoutSide
    | 'root'
    | 'tree-table-root'
    | 'tree-table-cell'
    | 'org-bottom'
    | 'org-hanging'
    | 'org-right-branch'
    | 'org-right'
    | 'timeline-point'
    | 'timeline-detail-top'
    | 'timeline-detail-bottom'
    | 'fishbone-top'
    | 'fishbone-bottom'
    | 'fishbone-rib-topic'
    | 'fishbone-rib-descendant';
  branchExpansion?: '' | 'side' | 'hanging';
  childBranchExpansion?: 'hanging-horizontal' | 'hanging-vertical';
  hangingSubtopicsHeight?: number;
  hangingSubtopicsWidth?: number;
  timelineAxisY?: number;
  timelineAxisMinX?: number;
  timelineAxisMaxX?: number;
  timelineAxisBandHalfHeight?: number;
  timelineBranchSide?: TimelineBranchSide;
  radialAngle?: number;
  radialChildAngle?: number;
  fishboneDirection?: FishboneDirection;
  fishboneSign?: FishboneDirection;
  fishboneMainSpineAttachX?: number;
  fishboneDiagonalBoneStartX?: number;
  fishboneDiagonalBoneStartY?: number;
  fishboneDiagonalBoneEndX?: number;
  fishboneDiagonalBoneEndY?: number;
  fishboneDiagonalBoneAttachX?: number;
  fishboneDiagonalBoneAttachY?: number;
}

export interface RadialLayoutBox extends LayoutBox {
  side?: LayoutSide;
}

export interface TreeTableLayoutBox extends LayoutBox {
  lines: unknown[];
  font: {
    size: number;
    lineHeight: number;
  };
  textY: number;
  treeTableColumn?: number;
  treeTableColumnSpan?: number;
}

export interface LayoutTopic<TBox extends LayoutBox = LayoutBox> {
  id: string;
  level?: number;
  subtopics: Array<LayoutTopic<TBox>>;
  _layout: TBox;
}

export interface MeasuredMindTopic<TBox extends LayoutBox = LayoutBox> extends Omit<
  MindTopic,
  'subtopics' | '_layout'
> {
  subtopics: Array<MeasuredMindTopic<TBox>>;
  _layout: TBox;
}

export interface LayoutConnector<TTopic extends LayoutTopic = LayoutTopic> {
  parentTopic: TTopic;
  subtopic: TTopic;
}

export interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface AxisAlignedBounds extends LayoutPoint {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface LayoutTranslation {
  dx: number;
  dy: number;
}
import type { MindTopic } from '../model/types.js';
