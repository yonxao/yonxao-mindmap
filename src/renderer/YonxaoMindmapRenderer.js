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
import { branchTrunkDrawMethods } from './draw/drawBranchTrunks.js';
import { connectorDrawMethods } from './draw/drawConnector.js';
import { fishboneDrawMethods } from './draw/drawFishbone.js';
import { timelineDrawMethods } from './draw/drawTimeline.js';
import { topicDrawMethods } from './draw/drawTopic.js';
import { topicControlDrawMethods } from './draw/drawTopicControls.js';
import { trunkSegmentDrawMethods } from './draw/drawTrunkSegments.js';
import { connectorGeometryMethods } from './draw/connectorGeometry.js';
import { topicControlPointMethods } from './draw/topicControlPoints.js';
import { copyTextMethods } from './export/copyText.js';
import { exportSvgMethods } from './export/exportSvg.js';
import { fullscreenControllerMethods } from './fullscreenController.js';
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

let sourceViewIdCounter = 0;

export class YonxaoMindmapRenderer extends Component {
  static viewModeMemory = new Map();
  static topicFocusMemory = new Map();

  constructor(plugin, source, hostEl, ctx, editorContext) {
    super();
    this.plugin = plugin;
    this.source = source;
    this.hostEl = hostEl;
    this.ctx = ctx;
    this.editorContext = editorContext || null;
    this.root = null;
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
    this.topicEditorEl = null;
    this.topicEditorFields = null;
    this.topicEditorInheritedValues = null;
    this.topicContentEditorEl = null;
    this.topicContentEditorInput = null;
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
    this.isWindowFullscreen = false;
    this._fsOverlay = null;
    this._hostElParent = null;
    this._hostElNextSibling = null;
    this._wfOverlay = null;
    this._wfHostElParent = null;
    this._wfHostElNextSibling = null;
    this._configModalOpen = false;
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
  collapseStateMethods,
  runtimeConfigSaveMethods,
  mapRendererMethods,
  branchTrunkDrawMethods,
  timelineDrawMethods,
  fishboneDrawMethods,
  connectorDrawMethods,
  connectorGeometryMethods,
  connectorPathMethods,
  trunkSegmentDrawMethods,
  topicDrawMethods,
  topicControlDrawMethods,
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
