/*
 * 文件作用：
 * 对已完成尺寸测量的主题树统一选择布局策略，并返回宿主可直接渲染的几何结果。
 */

import { layoutFishbone } from './fishboneLayout.js';
import { collectVisible, computeBounds } from './layoutBounds.js';
import type { BranchExpansion } from './layoutGeometry.js';
import { layoutHorizontalMind, layoutVerticalMind } from './mindmapLayout.js';
import { layoutOrgChart } from './orgLayout.js';
import { layoutRadial } from './radialLayout.js';
import type { RadialLayoutTopic } from './radialLayout.js';
import { layoutTimeline } from './timelineLayout.js';
import { layoutOutlineTree } from './treeLayout.js';
import { layoutTreeTable } from './treeTableLayout.js';
import type { TreeTableTopic } from './treeTableLayout.js';
import type { LayoutBounds, LayoutConnector, LayoutTopic } from './layoutTypes.js';

export const MINDMAP_LAYOUT_MODES = Object.freeze([
  'mindmap-right',
  'mindmap-left',
  'mindmap-bidirectional',
  'mindmap-up',
  'mindmap-down',
  'mindmap-vertical',
] as const);
export const TREE_LAYOUT_MODES = Object.freeze(['tree', 'tree-right', 'tree-left'] as const);
export const ORG_LAYOUT_MODES = Object.freeze(['org', 'org-right'] as const);
export const TIMELINE_LAYOUT_MODES = Object.freeze([
  'timeline',
  'timeline-up',
  'timeline-down',
] as const);
export const RADIAL_LAYOUT_MODES = Object.freeze(['radial'] as const);
export const FISHBONE_LAYOUT_MODES = Object.freeze(['fishbone-right', 'fishbone-left'] as const);
export const TREE_TABLE_LAYOUT_MODES = Object.freeze(['tree-table', 'tree-table-stepped'] as const);
export const LAYOUT_MODES = Object.freeze([
  ...MINDMAP_LAYOUT_MODES,
  ...TREE_LAYOUT_MODES,
  ...ORG_LAYOUT_MODES,
  ...TIMELINE_LAYOUT_MODES,
  ...RADIAL_LAYOUT_MODES,
  ...FISHBONE_LAYOUT_MODES,
  ...TREE_TABLE_LAYOUT_MODES,
] as const);

export type LayoutMode = (typeof LAYOUT_MODES)[number];

export interface LayoutTreeOptions {
  mode?: LayoutMode;
  branchExpansion?: BranchExpansion;
}

export interface LayoutTreeResult<
  TTopic extends LayoutTopic & { subtopics: TTopic[] } = LayoutTopic,
> {
  topics: TTopic[];
  connectors: Array<LayoutConnector<TTopic>>;
  bounds: LayoutBounds;
  mode: LayoutMode;
}

const DEFAULT_LAYOUT_MODE: LayoutMode = 'mindmap-right';
const layoutModeSet = new Set<string>(LAYOUT_MODES);

/*
 * 公共核心不测量文字和图标；调用方必须先给每个可见主题写入有限的 width/height。
 */
export function layoutTree<TTopic extends LayoutTopic & { subtopics: TTopic[] }>(
  root: TTopic,
  collapsedIds: ReadonlySet<string>,
  options: LayoutTreeOptions = {}
): LayoutTreeResult<TTopic> {
  const mode = normalizeLayoutMode(options.mode);
  const branchExpansion = options.branchExpansion === 'hanging' ? 'hanging' : 'side';
  const rootBox = root._layout;
  rootBox.x = 0;
  rootBox.y = 0;
  rootBox.side = 'root';

  switch (mode) {
    case 'mindmap-down':
    case 'mindmap-up':
    case 'mindmap-vertical':
      layoutVerticalMind(root, collapsedIds, mode, branchExpansion);
      break;
    case 'tree':
    case 'tree-right':
    case 'tree-left':
      layoutOutlineTree(root, collapsedIds, mode, branchExpansion);
      break;
    case 'org':
    case 'org-right':
      layoutOrgChart(root, collapsedIds, mode, branchExpansion);
      break;
    case 'timeline':
    case 'timeline-up':
    case 'timeline-down':
      layoutTimeline(root, collapsedIds, mode, branchExpansion);
      break;
    case 'radial':
      layoutRadial(root as RadialLayoutTopic, collapsedIds);
      break;
    case 'fishbone-left':
    case 'fishbone-right':
      layoutFishbone(root, collapsedIds, mode, branchExpansion);
      break;
    case 'tree-table':
      layoutTreeTable(root as LayoutTopic as TreeTableTopic, collapsedIds, {
        fillLeafRemainderColumns: true,
      });
      break;
    case 'tree-table-stepped':
      layoutTreeTable(root as LayoutTopic as TreeTableTopic, collapsedIds, {
        fillLeafRemainderColumns: false,
      });
      break;
    default:
      layoutHorizontalMind(root, collapsedIds, mode, branchExpansion);
  }

  const topics: TTopic[] = [];
  const connectors: Array<LayoutConnector<TTopic>> = [];
  collectVisible(root, collapsedIds, topics, connectors);

  return {
    topics,
    connectors,
    bounds: computeBounds(topics),
    mode,
  };
}

export function isLayoutMode(value: unknown): value is LayoutMode {
  return typeof value === 'string' && layoutModeSet.has(value);
}

export function normalizeLayoutMode(value: unknown): LayoutMode {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return isLayoutMode(normalized) ? normalized : DEFAULT_LAYOUT_MODE;
}

export function isMindMapLayoutType(value: unknown): boolean {
  return (
    value === 'mindmap-right' ||
    value === 'mindmap-left' ||
    value === 'mindmap-bidirectional' ||
    value === 'mindmap-down' ||
    value === 'mindmap-up' ||
    value === 'mindmap-vertical'
  );
}

export function isBranchExpansionSupportedLayout(value: unknown): boolean {
  return value !== 'radial' && value !== 'tree-table' && value !== 'tree-table-stepped';
}
