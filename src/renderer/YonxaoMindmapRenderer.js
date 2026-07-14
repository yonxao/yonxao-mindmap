/*
 * 文件作用：
 * 这是 yonxao-mindmap 的代码块实例调度器。
 *
 * 重构说明：
 * 原先所有 UI、渲染、交互和保存逻辑都集中在本文件。现在这些方法按职责拆到
 * renderer、ui、config、model 等子模块中，再通过 Object.assign 组合回原型，
 * 保持外部调用和用户可见行为不变。
 */

import { Component } from 'obsidian';

import { normalizeMindConfig } from '../config/mindConfig.js';
import { runtimeConfigSaveMethods } from '../config/runtimeConfigSave.js';
import { collapseStateMethods } from '../model/collapseState.js';
import { topicCommandMethods } from '../model/topicCommands.js';
import { topicHistoryMethods } from '../model/topicHistory.js';
import { branchTrunkDrawMethods } from './draw/drawBranchTrunks.js';
import { connectorDrawMethods } from './draw/drawConnector.js';
import { fishboneDrawMethods } from './draw/drawFishbone.js';
import { timelineDrawMethods } from './draw/drawTimeline.js';
import { topicDrawMethods } from './draw/drawTopic.js';
import { topicControlDrawMethods } from './draw/drawTopicControls.js';
import { watermarkDrawMethods } from './draw/drawWatermark.js';
import { trunkSegmentDrawMethods } from './draw/drawTrunkSegments.js';
import { connectorGeometryMethods } from './draw/connectorGeometry.js';
import { topicControlPointMethods } from './draw/topicControlPoints.js';
import { copyTextMethods } from './export/copyText.js';
import { exportSvgMethods } from './export/exportSvg.js';
import { fullscreenControllerMethods } from './fullscreenController.js';
import { fullscreenDraftRecoveryMethods } from './fullscreenDraftRecovery.js';
import { topicInteractionMethods } from './interaction/topicInteraction.js';
import { topicKeyboardShortcutMethods } from './interaction/topicKeyboardShortcuts.js';
import { mapRendererMethods } from './mapRenderer.js';
import { rendererContextMethods } from './rendererContext.js';
import { topicPointGeometryMethods } from './draw/topicPointGeometry.js';
import { connectorPathMethods } from './draw/connectorPaths.js';
import { rendererStateMethods } from './rendererState.js';
import { documentPersistenceMethods } from './documentPersistence.js';
import { canvasHeightMethods } from './viewport/canvasHeight.js';
import { panZoomControllerMethods } from './viewport/panZoomController.js';
import { viewFitMethods } from './viewport/viewFit.js';
import { mapContextMenuMethods } from '../ui/context-menu/mapContextMenu.js';
import { topicContextMenuMethods } from '../ui/context-menu/topicContextMenu.js';
import { sourceDocumentMethods } from '../ui/source/sourceDocument.js';
import { sourceHighlightMethods } from '../ui/source/sourceHighlight.js';
import { sourceStatusMethods } from '../ui/source/sourceStatus.js';
import { sourceViewMethods } from '../ui/source/SourceView.js';
import { inlineTopicEditorMethods } from '../ui/topic-editor/InlineTopicEditor.js';
import { topicEditorFieldMethods } from '../ui/topic-editor/TopicEditorFields.js';
import { topicEditorPanelMethods } from '../ui/topic-editor/TopicEditorPanel.js';
import { topicContentEditorMethods } from '../ui/topic-editor/TopicContentEditor.js';
import { topicEditorStateMethods } from '../ui/topic-editor/topicEditorState.js';
import { floatingToolbarMethods } from '../ui/toolbar/FloatingToolbar.js';
import { toolbarButtonMethods } from '../ui/toolbar/toolbarButtons.js';
import { toolbarPositionMethods } from '../ui/toolbar/toolbarPosition.js';
// 高级结构（关联/概要/外框）的业务逻辑和 SVG 绘制分别来自 model 和 renderer/draw。
import { mindStructureMethods } from '../model/mindStructures.js';
import { structureDrawMethods } from './draw/drawStructures.js';

let sourceViewIdCounter = 0;

export class YonxaoMindmapRenderer extends Component {
  static viewModeMemory = new Map();
  static sourceStatusMemory = new Map();
  static topicFocusMemory = new Map();
  static topicHistoryMemory = new Map();
  // Obsidian 保存后可能重建代码块；跨 renderer 复用图片尺寸可避免先按默认比例、再按真实比例布局。
  static topicImageNaturalSizeMemory = new Map();

  constructor(plugin, source, hostEl, ctx, editorContext) {
    super();
    this.plugin = plugin;
    this.source = source;
    this.hostEl = hostEl;
    this.ctx = ctx;
    this.editorContext = editorContext || null;
    this.root = null;
    // 高级结构数据（关联/概要/外框），由 parseMindDocument 解析后注入。
    this.structures = [];
    // 当前选中的结构状态：null 表示未选中，对象包含 topicIds、type 等字段。
    this.structureSelection = null;
    // 选中结构的 id，用于查找和状态管理。
    this.selectedStructureId = '';
    // 关联曲线控制柄拖拽状态，非 null 时表示用户正在拖拽控制点调整关联路径。
    this.structureControlDragState = null;
    // 结构选中后底部操作栏的 DOM 引用。
    this.structureSelectionBarEl = null;
    this.structureSelectionStatusEl = null;
    this.structureSelectionHintEl = null;
    this.structureSelectionFinishButton = null;
    // 操作栏拖拽状态，用于在桌面端拖拽移动操作栏位置。
    this.structureSelectionBarDragState = null;
    this.rawConfig = {};
    this.config = normalizeMindConfig({});
    this.hasConfigBlock = false;
    this.containerEl = null;
    this.toolbarEl = null;
    this.svgEl = null;
    this.mapEl = null;
    this.sourceEl = null;
    this.heightResizeHandleEl = null;
    this.sourceInputEl = null;
    this.sourceConfigInputEl = null;
    this.sourceConfigEditorEl = null;
    this.sourceConfigHighlightEl = null;
    this.sourceConfigLineNumbersEl = null;
    this.sourceBodyEditorEl = null;
    this.sourceBodyHighlightEl = null;
    this.sourceBodyLineNumbersEl = null;
    this.sourceTabButtons = null;
    this.sourceActiveTab = 'body';
    sourceViewIdCounter += 1;
    this.sourceViewIdPrefix = `yonxao-mindmap-source-${sourceViewIdCounter}`;
    this.sourceStatusEl = null;
    this.sourceViewGlobalShortcutInstalled = false;
    this.topicEditorEl = null;
    this.topicEditorFields = null;
    this.topicEditorInheritedValues = null;
    this.topicContentEditorEl = null;
    this.topicContentEditorInput = null;
    this.topicAdornmentPopoverEl = null;
    this.topicAdornmentAnchorEl = null;
    this.topicAdornmentHideTimer = null;
    this.topicAdornmentDocumentClickInstalled = false;
    this.topicImagePreviewEl = null;
    this.topicImagePreviewKeydownInstalled = false;
    // 整图重绘期间临时复用已解码的 SVG 图片元素，避免图片短暂消失造成画布闪动。
    this.topicImageElementPool = null;
    this.pendingTopicImageNaturalSizeFrame = null;
    this.inlineTextEditorEl = null;
    this.inlineTextEditorInput = null;
    this.inlineEditingTopicId = null;
    this.inlineTextEditorSaving = false;
    this.inlineTextEditorCancelling = false;
    this.topicDropIndicatorEl = null;
    this.hoveredTopicControlId = '';
    this.focusedTopicId = '';
    this.focusedTopicRevision = 0;
    this.topicById = new Map();
    this.collapsedIds = new Set();
    this.viewBox = null;
    // 上次渲染时包含高级结构边界的完整矩形，供视图适配复用，避免重算遗漏 outer structures。
    this.renderedMapBounds = null;
    this.panState = null;
    this.topicDragState = null;
    this.heightResizeState = null;
    this.toolbarDragState = null;
    this.pendingToolbarHideTimer = null;
    this.pendingToolbarScrollTimer = null;
    this.suppressToolbarDuringScroll = false;
    this.topicEditorDragState = null;
    this.topicContentEditorDragState = null;
    this.manualCanvasHeight = false;
    this.manualSourceHeight = false;
    this.isSourceMode = false;
    this.didInitialMapRender = false;
    this.sourceDirty = false;
    this.editingTopicId = null;
    this.toggleViewButton = null;
    this.viewFitButton = null;
    this.fullscreenButton = null;
    this.mapActionButtons = [];
    this.suppressNextTopicClick = false;
    this.pendingFitFrame = null;
    this.pendingToolbarFrame = null;
    this.pendingSourceHeightFrame = null;
    this.pendingMapFocusFrame = null;
    this.pendingMapFocusTimer = null;
    this.containerResizeObserver = null;
    this.lastObservedContainerWidth = 0;
    this.sourceLineCount = 1;
    this.fitRetryCount = 0;
    this.currentViewFitMode = null;
    this.isFullscreen = false;
    this._fullscreenRequestPending = false;
    this.isWindowFullscreen = false;
    this._fsOverlay = null;
    this._hostElParent = null;
    this._hostElNextSibling = null;
    this._wfOverlay = null;
    this._wfHostElParent = null;
    this._wfHostElNextSibling = null;
    this._fullscreenFocusTopicId = '';
    this._fullscreenScrollSnapshot = null;
    this.fullscreenDraftIdentity = null;
    this.pendingFullscreenDraftSnapshot = null;
    this.fullscreenDraftRecoveryEl = null;
    this._configModalOpen = false;
    this.topicUndoStack = [];
    this.topicRedoStack = [];
    this.suppressTopicHistorySnapshot = false;
  }
}

Object.assign(
  YonxaoMindmapRenderer.prototype,
  rendererContextMethods,
  rendererStateMethods,
  documentPersistenceMethods,
  floatingToolbarMethods,
  toolbarPositionMethods,
  toolbarButtonMethods,
  fullscreenControllerMethods,
  fullscreenDraftRecoveryMethods,
  sourceViewMethods,
  sourceDocumentMethods,
  sourceHighlightMethods,
  sourceStatusMethods,
  canvasHeightMethods,
  topicEditorPanelMethods,
  topicEditorFieldMethods,
  topicContentEditorMethods,
  inlineTopicEditorMethods,
  topicEditorStateMethods,
  topicCommandMethods,
  topicHistoryMethods,
  // 高级结构业务逻辑：创建/删除/验证/选中/取消关联、概要、外框。
  mindStructureMethods,
  collapseStateMethods,
  runtimeConfigSaveMethods,
  mapRendererMethods,
  // 高级结构 SVG 绘制：关联路径/箭头、概要标签、外框矩形及其交互控制柄。
  structureDrawMethods,
  branchTrunkDrawMethods,
  timelineDrawMethods,
  fishboneDrawMethods,
  connectorDrawMethods,
  connectorGeometryMethods,
  connectorPathMethods,
  trunkSegmentDrawMethods,
  topicDrawMethods,
  topicControlDrawMethods,
  watermarkDrawMethods,
  topicControlPointMethods,
  topicPointGeometryMethods,
  topicInteractionMethods,
  topicKeyboardShortcutMethods,
  topicContextMenuMethods,
  mapContextMenuMethods,
  exportSvgMethods,
  copyTextMethods,
  panZoomControllerMethods,
  viewFitMethods
);
