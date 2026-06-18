/*
 * 文件作用：
 * 这是插件的核心渲染器，负责把 yxmm 源码变成可交互的思维导图界面。
 *
 * 主要功能：
 * - 创建工具栏、SVG 幕布、源码编辑区、主题编辑面板和高度拖拽条。
 * - 调用 parser 把 主题级别标记源码解析成树。
 * - 调用 layout 计算主题坐标，再把主题和连线绘制成 SVG。
 * - 处理源码保存、导图主题编辑、折叠/展开、缩放、拖动幕布和高度调整。
 *
 * 调用链位置：
 * YonxaoMindmapPlugin -> new YonxaoMindmapRenderer(...) -> mount() -> renderMap()
 */

import { Component, Menu, Notice, setIcon } from 'obsidian';

import {
  CODE_BLOCK_NAME,
  VIEWBOX_MARGIN_X,
  VIEWBOX_MARGIN_Y,
  CANVAS_MIN_HEIGHT,
  CANVAS_MAX_HEIGHT,
  TOPIC_MIN_HEIGHT,
  TOPIC_PADDING_X,
  LEVEL_GAP,
} from '../constants.js';
import {
  canonicalizeMindConfig,
  deleteMindConfigPath,
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  TOPIC_MAX_WIDTH_MAX,
  TOPIC_MAX_WIDTH_MIN,
  TOOLBAR_CORNERS,
  TOOLBAR_PLACEMENTS,
  hasMeaningfulConfig,
  mergeMindConfigObjects,
  normalizeMindConfig,
  serializeMindSource,
  setMindConfigPath,
} from '../config/mindConfig.js';
import { ICON_PATHS } from '../icons/iconPaths.js';
import { normalizeIcon, renderIcon } from '../icons/renderIcon.js';
import { layoutTree } from '../layout/layoutTree.js';
import { replaceCodeBlockSource } from '../markdown/codeBlock.js';
import {
  containsTopicId,
  countTopicDescendants,
  insertSiblingTopic,
  moveTopicInTree,
  removeTopicById,
  setOptionalTopicAttribute,
} from '../model/topicTreeActions.js';
import { markYonxaoMindmapEmbedWrapper } from '../obsidian/embed.js';
import { assignIds, createMindTopic, parseMindDocument } from '../parser/parseMind.js';
import { serializeMindDocument } from '../parser/serializeMind.js';
import { applyTopicLevelKey } from '../source/topicLevelKeys.js';
import { themeConnectorOpacity, themeTopicFillAlpha } from '../theme/mindThemes.js';
import { ConfigModal } from '../ui/ConfigModal.js';
import {
  CUSTOM_FONT_VALUE,
  getLocalizedFontFamilyGroups,
  isValidFontFamilyInput,
  isPresetFontValue,
  normalizeFontFamilyInput,
} from '../ui/fontOptions.js';
import { connectorColor, topicColor, transparentColor } from '../utils/color.js';
import { createLabeledField } from '../utils/dom.js';
import { clamp } from '../utils/math.js';
import { svg } from '../utils/svg.js';
import { normalizeTopicTextForStorage } from '../utils/text.js';

const TOPIC_EDITOR_COLOR_SWATCHES = Object.freeze([
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
]);

const DOCUMENT_CONFIG_DEFAULT_PRUNE_PATHS = Object.freeze([
  ['basic', 'canvasHeight'],
  ['basic', 'sourceHeight'],
  ['basic', 'tabIndent'],
  ['basic', 'toolbar', 'corner'],
  ['basic', 'toolbar', 'placement'],
  ['basic', 'viewFit'],
  ['basic', 'wheelZoom'],
  ['theme', 'scheme'],
  ['theme', 'defaultTopicColor'],
  ['layout', 'type'],
  ['layout', 'connectorStyle'],
  ['layout', 'branchExpansion'],
  ['layout', 'topicMaxWidth', 'global'],
  ['font', 'family'],
  ['font', 'size'],
  ['font', 'weight'],
  ['font', 'lineHeight'],
]);

let sourceViewIdCounter = 0;

export class YonxaoMindmapRenderer extends Component {
  static viewModeMemory = new Map();

  /*
   * 作用：
   * 保存渲染器所需的上下文、DOM 引用、交互状态和编辑状态。
   *
   * 调用链：
   * YonxaoMindmapPlugin.onload() -> new YonxaoMindmapRenderer(...)。
   */
  constructor(plugin, source, hostEl, ctx, editorContext) {
    super();
    this.plugin = plugin;
    this.source = source;
    this.hostEl = hostEl;
    this.ctx = ctx;
    this.editorContext = editorContext || null;
    this.root = null;
    this.rawConfig = {};
    this.config = normalizeMindConfig(this.buildEffectiveRawConfig({}));
    this.hasConfigBlock = false;
    this.containerEl = null;
    this.toolbarEl = null;
    this.svgEl = null;
    this.mapEl = null;
    this.sourceEl = null;
    this.heightResizeHandleEl = null;
    this.sourceInputEl = null;
    this.sourceConfigInputEl = null;
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
    this.topicTextEditorEl = null;
    this.topicTextEditorInput = null;
    this.inlineTextEditorEl = null;
    this.inlineTextEditorInput = null;
    this.inlineEditingTopicId = null;
    this.inlineTextEditorSaving = false;
    this.topicDropIndicatorEl = null;
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
    this.topicTextEditorDragState = null;
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
    this.containerResizeObserver = null;
    this.lastObservedContainerWidth = 0;
    this.sourceLineCount = 1;
    this.fitRetryCount = 0;
    this.currentViewFitMode = null;
    this.isFullscreen = false;
  }

  /*
   * 作用：
   * Renderer 被 Obsidian 卸载时，清理挂在 body 上的浮层。
   */
  onunload() {
    this.closeTopicEditor();
    this.closeInlineTextEditor(false);
    this.hostEl?.classList.remove('is-fullscreen');
    this.restoreToolbarToBody();
    if (this.topicEditorEl) {
      this.topicEditorEl.remove();
    }
    this.topicEditorEl = null;
    this.topicEditorFields = null;
    if (this.topicTextEditorEl) {
      this.topicTextEditorEl.remove();
    }
    this.topicTextEditorEl = null;
    this.topicTextEditorInput = null;
    if (this.pendingToolbarHideTimer) {
      window.clearTimeout(this.pendingToolbarHideTimer);
      this.pendingToolbarHideTimer = null;
    }
    if (this.pendingToolbarScrollTimer) {
      window.clearTimeout(this.pendingToolbarScrollTimer);
      this.pendingToolbarScrollTimer = null;
    }
    if (this.toolbarEl) {
      this.toolbarEl.remove();
    }
    this.toolbarEl = null;
    if (this.containerResizeObserver) {
      this.containerResizeObserver.disconnect();
      this.containerResizeObserver = null;
    }
  }

  /*
   * 作用：
   * 渲染器挂载入口，负责解析源码、创建 DOM 结构并完成首次绘制。
   *
   * 调用链：
   * Plugin code block processor -> renderer.mount()。
   *
   * 实现逻辑：
   * 先解析 source；失败时创建一个兜底根主题并切到源码模式显示错误。
   */
  mount() {
    this.hostEl.textContent = '';
    this.hostEl.classList.add('yonxao-mindmap-host');
    markYonxaoMindmapEmbedWrapper(this.hostEl);
    let parseError = '';

    // 先解析，再创建 DOM。解析失败时给用户一个清晰的错误块，避免空白区域。
    try {
      this.root = this.parseAndApplyDocument(this.source);
    } catch (error) {
      parseError = `源码解析失败：${error.message || String(error)}`;
    }

    if (!this.root) {
      parseError = parseError || '源码为空，请在源码模式中编辑后保存。';
      this.root = createMindTopic('Mind', {}, []);
      assignIds(this.root, '0');
    }

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'yonxao-mindmap-container';
    this.hostEl.appendChild(this.containerEl);

    this.createToolbar();
    this.createSvg();
    this.createSourceView();
    this.createTopicEditor();
    this.createHeightResizeHandle();
    this.applyRuntimeConfigToView();
    this.installContainerResizeObserver();
    this.installEventBoundary();
    this.renderMap(true);
    if (parseError) {
      this.showSourceMode(parseError);
    }
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();

    this.registerDomEvent(window, 'resize', () => {
      this.scheduleFitView();
      this.scheduleApplyToolbarPosition();
    });
    this.installToolbarScrollListeners();
  }

  /*
   * 作用：
   * 解析完整 yxmm 文档，并同步当前渲染器的配置状态。
   *
   * 调用链：
   * mount()/saveFromSourceView() -> parseAndApplyDocument()。
   */
  parseAndApplyDocument(source) {
    const document = parseMindDocument(source);
    this.rawConfig = canonicalizeMindConfig(document.rawConfig || {});
    this.refreshNormalizedConfig();
    this.hasConfigBlock = document.hasConfig;
    return document.root;
  }

  /*
   * 作用：
   * 判断当前渲染器是否允许修改主题正文和树结构。
   *
   * 实现逻辑：
   * editorContext 是最直接的编辑器上下文；但当前插件主要走 Obsidian 官方
   * Markdown code block processor，Live Preview 下也可能拿不到 editorContext。
   * 因此这里再用 DOM 外壳判断：Live Preview 通常位于 .markdown-source-view/.cm-embed-block，
   * 阅读视图通常位于 .markdown-reading-view/.markdown-preview-view。
   *
   * 注意：
   * 折叠/展开、平移、缩放这类浏览行为不依赖这个判断。
   */
  canEditMindMap() {
    if (this.editorContext) return true;
    if (!this.hostEl || !this.hostEl.closest) return false;

    if (this.hostEl.closest('.markdown-reading-view, .markdown-preview-view')) {
      return false;
    }

    return Boolean(this.hostEl.closest('.markdown-source-view, .cm-embed-block, .cm-editor'));
  }

  /*
   * 作用：
   * 把配置区里的运行时配置应用到当前 DOM 视图。
   *
   * 目前接入：
   * - canvas.height 控制幕布手动高度。
   * - toolbar.corner/placement 控制工具栏吸附位置。
   */
  applyRuntimeConfigToView() {
    this.applyConfiguredCanvasHeight();
    this.applyConfiguredViewMode();
    this.scheduleApplyToolbarPosition();
  }

  /*
   * 作用：
   * 根据配置区 canvas.height 恢复用户上次手动调整的幕布高度。
   */
  applyConfiguredCanvasHeight() {
    if (!this.containerEl) return;
    if (this.isSourceMode) return;

    const height = this.config.canvas.height;
    if (height) {
      this.manualCanvasHeight = true;
      this.containerEl.style.height = `${Math.round(height)}px`;
      return;
    }

    this.manualCanvasHeight = false;
    this.containerEl.style.height = '';
  }

  /*
   * 作用：
   * 监听幕布宽度变化，在 Obsidian 切换阅读视图或侧栏布局稳定后重新适配自动高度。
   *
   * 为什么需要：
   * Markdown 阅读视图切换时，代码块渲染常常早于最终内容宽度稳定。
   * 如果只按首次宽度计算自动高度，容器可能保留默认高度，导致上下出现大块空白。
   */
  installContainerResizeObserver() {
    if (
      !this.containerEl ||
      typeof window === 'undefined' ||
      typeof window.ResizeObserver !== 'function'
    ) {
      return;
    }

    this.containerResizeObserver = new window.ResizeObserver((entries) => {
      const entry = entries[0];
      const width =
        entry?.contentRect?.width || this.containerEl?.getBoundingClientRect().width || 0;
      if (!width || Math.abs(width - this.lastObservedContainerWidth) < 1) return;

      this.lastObservedContainerWidth = width;
      this.scheduleFitView();
      this.scheduleApplyToolbarPosition();
    });
    this.containerResizeObserver.observe(this.containerEl);
  }

  /*
   * 作用：
   * 根据短时会话状态恢复源码/导图视图。
   *
   * 为什么需要它：
   * 工具栏位置保存会写回 Markdown，Obsidian 可能因此重建代码块 DOM。
   * 如果重建后的实例不知道之前处于源码模式，就会回到默认导图模式。
   */
  applyConfiguredViewMode() {
    const shouldUseSourceMode = this.readSessionViewMode() === 'source';
    this.isSourceMode = shouldUseSourceMode;

    if (this.containerEl) {
      this.containerEl.classList.toggle('is-source-mode', this.isSourceMode);
    }
    this.hostEl.classList.toggle('is-source-mode', this.isSourceMode);

    for (const button of this.mapActionButtons) {
      button.disabled = this.isSourceMode;
    }

    if (this.isSourceMode) {
      this.closeTopicEditor();
      this.syncSourceInput();
      this.scheduleSourceModeHeight();
    }

    this.updateToggleViewButton();
  }

  /*
   * 作用：
   * 把当前视图模式写入 rawConfig，但不立刻保存文件。
   *
   * 调用场景：
   * 用户切换源码/导图后，后续如果拖动工具栏或调整高度触发配置保存，就能顺手保留当前模式。
   */
  rememberViewModeConfig() {
    this.writeSessionViewMode(this.isSourceMode ? 'source' : 'map');
  }

  /*
   * 作用：
   * 读取当前代码块的短时视图模式。
   *
   * 设计原因：
   * 视图模式不再写入 Markdown 配置区，避免阅读视图打开时仍显示源码。
   * 这里只保留几秒钟，专门应对保存工具栏/高度后 Obsidian 立即重建 DOM 的场景。
   */
  readSessionViewMode() {
    const key = this.viewModeMemoryKey();
    const record = YonxaoMindmapRenderer.viewModeMemory.get(key);
    if (!record || record.expiresAt < Date.now()) {
      YonxaoMindmapRenderer.viewModeMemory.delete(key);
      return 'map';
    }

    return record.mode;
  }

  /*
   * 作用：
   * 写入当前代码块的短时视图模式。
   */
  writeSessionViewMode(mode) {
    YonxaoMindmapRenderer.viewModeMemory.set(this.viewModeMemoryKey(), {
      mode,
      expiresAt: Date.now() + 6000,
    });
  }

  /*
   * 作用：
   * 生成当前代码块的短时状态 key。
   */
  viewModeMemoryKey() {
    const sourcePath = this.ctx?.sourcePath || 'unknown';
    const sectionInfo =
      this.ctx && typeof this.ctx.getSectionInfo === 'function'
        ? this.ctx.getSectionInfo(this.hostEl)
        : null;

    if (sectionInfo) {
      return `${sourcePath}:${sectionInfo.lineStart}`;
    }

    return `${sourcePath}:${String(this.source || '').slice(0, 80)}`;
  }

  /*
   * 作用：
   * 创建可吸附到幕布四角内侧或外侧的悬浮工具栏。
   *
   * 调用链：
   * mount() -> createToolbar() -> createToolbarButton()。
   */
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'yonxao-mindmap-toolbar';
    this.toolbarEl = toolbar;
    document.body.appendChild(toolbar);

    this.installToolbarVisibilityEvents();
    this.installToolbarEventBoundary();

    this.createToolbarDragHandle(toolbar);

    // 源码/导图切换按钮和配置按钮始终可用；其它按钮只对导图视图有意义。
    this.toggleViewButton = this.createToolbarButton(
      toolbar,
      this.t('toolbar.showSource'),
      'code-2',
      async () => {
        await this.toggleSourceMode();
      }
    );

    this.createToolbarButton(toolbar, this.t('toolbar.config'), 'settings', () => {
      this.openConfigModal();
    });

    this.viewFitButton = this.createToolbarButton(
      toolbar,
      this.t('toolbar.fitView'),
      'maximize',
      () => this.toggleViewFitMode()
    );
    this.mapActionButtons.push(this.viewFitButton);
    this.fullscreenButton = this.createToolbarButton(
      toolbar,
      this.t('toolbar.enterFullscreen'),
      'maximize-2',
      () => this.toggleFullscreen()
    );
    this.mapActionButtons.push(this.fullscreenButton);
    this.mapActionButtons.push(
      this.createToolbarButton(toolbar, this.t('toolbar.zoomIn'), 'zoom-in', () =>
        this.zoomAtCenter(0.82)
      )
    );
    this.mapActionButtons.push(
      this.createToolbarButton(toolbar, this.t('toolbar.zoomOut'), 'zoom-out', () =>
        this.zoomAtCenter(1.18)
      )
    );
    this.mapActionButtons.push(
      this.createToolbarButton(toolbar, this.t('toolbar.resetCollapse'), 'refresh-cw', () => {
        this.collapsedIds.clear();
        this.renderMap(true);
      })
    );

    this.updateToggleViewButton();
    this.updateFullscreenButton();
    if (typeof document !== 'undefined') {
      this.registerDomEvent(document, 'fullscreenchange', () => this.handleFullscreenChange());
    }
  }

  /*
   * 作用：
   * body 级工具栏不能再依赖 .host:hover CSS 选择器，这里用事件控制显示和隐藏。
   */
  installToolbarVisibilityEvents() {
    const show = () => this.showToolbar();
    const scheduleHide = () => this.scheduleHideToolbar();

    this.registerDomEvent(this.hostEl, 'mouseenter', show);
    this.registerDomEvent(this.hostEl, 'mouseleave', scheduleHide);
    this.registerDomEvent(this.hostEl, 'focusin', show);
    this.registerDomEvent(this.hostEl, 'focusout', scheduleHide);
    this.registerDomEvent(this.toolbarEl, 'mouseenter', show);
    this.registerDomEvent(this.toolbarEl, 'mouseleave', scheduleHide);
    this.registerDomEvent(this.toolbarEl, 'focusin', show);
    this.registerDomEvent(this.toolbarEl, 'focusout', scheduleHide);
    this.registerDomEvent(this.hostEl, 'wheel', () => this.handleToolbarScroll(260));
    this.registerDomEvent(this.hostEl, 'pointerdown', (event) => {
      if (event.button === 1) this.handleToolbarScroll(700);
    });
  }

  /*
   * 作用：
   * 监听 Obsidian 内部真实滚动容器。Live Preview 的滚动常发生在内部 scroller，
   * 只听 window/document 普通 scroll 不够稳定，所以这里把可滚动祖先也纳入监听。
   */
  installToolbarScrollListeners() {
    const targets = new Set([window, document]);
    let element = this.hostEl;
    while (element && element !== document.body) {
      if (this.isScrollableElement(element)) {
        targets.add(element);
      }
      element = element.parentElement;
    }

    const listener = () => this.handleToolbarScroll();
    for (const target of targets) {
      target.addEventListener('scroll', listener, { capture: true, passive: true });
      this.register(() => {
        target.removeEventListener('scroll', listener, { capture: true });
      });
    }
  }

  /*
   * 作用：
   * 判断某个祖先元素是否可能是 Obsidian 的滚动容器。
   */
  isScrollableElement(element) {
    if (!element || element === document.documentElement) return false;
    const style = window.getComputedStyle(element);
    const overflow = `${style.overflow} ${style.overflowY} ${style.overflowX}`;
    if (!/(auto|scroll|overlay)/.test(overflow)) return false;
    return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
  }

  /*
   * 作用：
   * 工具栏挂到 body 后，需要自己阻止事件继续冒泡到 Obsidian 外层编辑器。
   */
  installToolbarEventBoundary() {
    for (const eventName of [
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'pointerdown',
      'pointerup',
      'keydown',
      'keyup',
      'wheel',
    ]) {
      this.registerDomEvent(this.toolbarEl, eventName, (event) => {
        event.stopPropagation();
      });
    }
  }

  /*
   * 作用：
   * 显示 body 级工具栏，并取消正在等待的隐藏动作。
   */
  showToolbar() {
    if (!this.toolbarEl) return;
    if (this.pendingToolbarHideTimer) {
      window.clearTimeout(this.pendingToolbarHideTimer);
      this.pendingToolbarHideTimer = null;
    }
    if (this.suppressToolbarDuringScroll) {
      this.hideToolbar();
      return;
    }
    if (!this.isToolbarHostNearViewport()) {
      this.hideToolbar();
      return;
    }
    this.applyToolbarPosition();
    this.toolbarEl.classList.add('is-visible');
    this.scheduleApplyToolbarPosition();
  }

  /*
   * 作用：
   * 延迟隐藏工具栏，给鼠标从导图区域移动到 body 级工具栏留一点时间。
   */
  scheduleHideToolbar() {
    if (this.pendingToolbarHideTimer) {
      window.clearTimeout(this.pendingToolbarHideTimer);
    }
    this.pendingToolbarHideTimer = window.setTimeout(() => {
      this.pendingToolbarHideTimer = null;
      if (this.shouldKeepToolbarVisible()) return;
      this.hideToolbar();
    }, 140);
  }

  /*
   * 作用：
   * 隐藏 body 级工具栏。
   */
  hideToolbar() {
    this.toolbarEl?.classList.remove('is-visible');
  }

  /*
   * 作用：
   * 判断工具栏是否仍应保持可见。
   */
  shouldKeepToolbarVisible() {
    if (this.toolbarDragState) return true;
    if (this.suppressToolbarDuringScroll) return false;
    const activeElement = document.activeElement;
    return Boolean(
      this.hostEl?.matches?.(':hover') ||
      this.toolbarEl?.matches?.(':hover') ||
      (activeElement && this.hostEl?.contains(activeElement)) ||
      (activeElement && this.toolbarEl?.contains(activeElement))
    );
  }

  /*
   * 作用：
   * 页面滚动时不显示工具栏，避免 body 级浮层在旧位置闪现或跟随滚动造成干扰。
   */
  handleToolbarScroll(quietMs = 180) {
    if (!this.toolbarEl) return;
    this.suppressToolbarDuringScroll = true;
    this.hideToolbar();

    if (this.pendingToolbarScrollTimer) {
      window.clearTimeout(this.pendingToolbarScrollTimer);
    }

    this.pendingToolbarScrollTimer = window.setTimeout(() => {
      this.pendingToolbarScrollTimer = null;
      this.suppressToolbarDuringScroll = false;
      if (this.shouldKeepToolbarVisible()) {
        this.showToolbar();
      }
    }, quietMs);
  }

  /*
   * 作用：
   * 判断当前导图宿主是否仍在视口附近。
   */
  isToolbarHostNearViewport() {
    if (!this.hostEl) return false;
    const rect = this.hostEl.getBoundingClientRect();
    const margin = 64;
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
  }

  /*
   * 作用：
   * 创建工具栏抓手，用来调整工具栏位置。
   *
   * 实现逻辑：
   * 只让这个小手柄负责拖动，普通工具按钮仍然保持点击语义，避免拖拽逻辑抢走按钮点击。
   */
  createToolbarDragHandle(toolbar) {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'yonxao-mindmap-toolbar-button yonxao-mindmap-toolbar-drag-handle';
    handle.setAttribute('aria-label', this.t('toolbar.dragHandle'));

    try {
      setIcon(handle, 'move');
    } catch (_error) {
      handle.textContent = '+';
    }

    toolbar.appendChild(handle);
    this.registerDomEvent(handle, 'pointerdown', (event) => {
      this.handleToolbarPointerDown(event);
    });
    this.registerDomEvent(handle, 'pointermove', (event) => {
      this.handleToolbarPointerMove(event);
    });
    this.registerDomEvent(handle, 'pointerup', (event) => {
      this.handleToolbarPointerUp(event);
    });
    this.registerDomEvent(handle, 'pointercancel', (event) => {
      this.handleToolbarPointerUp(event);
    });
  }

  /*
   * 作用：
   * 开始拖动工具栏，记录指针起点和工具栏当前位置。
   */
  handleToolbarPointerDown(event) {
    if (!this.toolbarEl || !this.hostEl) return;

    event.preventDefault();
    event.stopPropagation();

    const toolbarRect = this.toolbarEl.getBoundingClientRect();
    const hostRect = this.hostEl.getBoundingClientRect();
    this.toolbarDragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: toolbarRect.left - hostRect.left,
      startY: toolbarRect.top - hostRect.top,
    };

    this.toolbarEl.classList.add('is-dragging-toolbar');

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (_error) {
      // Pointer Capture 只是增强拖拽稳定性，不支持时仍可依赖普通 pointermove。
    }
  }

  /*
   * 作用：
   * 拖动过程中实时更新工具栏位置。
   */
  handleToolbarPointerMove(event) {
    if (!this.toolbarDragState || !this.toolbarEl) return;

    event.preventDefault();
    const nextX = this.toolbarDragState.startX + event.clientX - this.toolbarDragState.startClientX;
    const nextY = this.toolbarDragState.startY + event.clientY - this.toolbarDragState.startClientY;
    this.setToolbarPosition(nextX, nextY);
  }

  /*
   * 作用：
   * 结束工具栏拖动，并把位置写入配置区。
   */
  handleToolbarPointerUp(event) {
    if (!this.toolbarDragState || !this.toolbarEl) return;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 未捕获指针时释放会失败，可以安全忽略。
    }

    this.toolbarDragState = null;
    this.toolbarEl.classList.remove('is-dragging-toolbar');

    const snap = this.nearestToolbarSnap();
    if (!snap) return;

    this.rawConfig = setMindConfigPath(this.rawConfig, ['basic', 'toolbar', 'corner'], snap.corner);
    this.rawConfig = setMindConfigPath(
      this.rawConfig,
      ['basic', 'toolbar', 'placement'],
      snap.placement
    );
    this.rawConfig = deleteMindConfigPath(this.rawConfig, ['toolbar', 'x']);
    this.rawConfig = deleteMindConfigPath(this.rawConfig, ['toolbar', 'y']);
    this.rememberViewModeConfig();
    this.refreshNormalizedConfig();
    this.scheduleApplyToolbarPosition();
    Promise.resolve(this.saveRuntimeConfigToFile()).catch((error) => {
      new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
    });
  }

  /*
   * 作用：
   * 从配置区恢复工具栏吸附位置。
   */
  applyToolbarPosition() {
    if (!this.toolbarEl) return;

    this.setToolbarSnap(this.config.toolbar.corner, this.config.toolbar.placement);
  }

  /*
   * 作用：
   * 延迟一帧恢复工具栏位置。
   *
   * 为什么要延迟：
   * Obsidian 保存代码块后可能会立刻重建预览 DOM；新 DOM 刚创建时，host/container 的尺寸还未稳定。
   * 如果这时立刻计算吸附点，位置可能因宿主尺寸未稳定而短暂偏移。
   */
  scheduleApplyToolbarPosition() {
    if (this.pendingToolbarFrame || typeof window === 'undefined') return;

    this.pendingToolbarFrame = window.requestAnimationFrame(() => {
      this.pendingToolbarFrame = null;
      this.applyToolbarPosition();
    });
  }

  /*
   * 作用：
   * 设置 body 级工具栏坐标。拖动过程中允许临时停在任意位置。
   */
  setToolbarPosition(x, y) {
    if (!this.toolbarEl || !this.hostEl) return;

    const hostRect = this.hostEl.getBoundingClientRect();
    const toolbarRect = this.toolbarEl.getBoundingClientRect();
    if (!hostRect.width || !toolbarRect.width || !toolbarRect.height) {
      this.scheduleApplyToolbarPosition();
      return;
    }

    const gap = 8;
    const maxLeft = Math.max(gap, window.innerWidth - toolbarRect.width - gap);
    const maxTop = Math.max(gap, window.innerHeight - toolbarRect.height - gap);
    const left = clamp(hostRect.left + x, gap, maxLeft);
    const top = clamp(hostRect.top + y, gap, maxTop);

    this.toolbarEl.style.left = `${Math.round(left)}px`;
    this.toolbarEl.style.top = `${Math.round(top)}px`;
  }

  /*
   * 作用：
   * 根据配置的角落和内外侧设置工具栏吸附位置。
   */
  setToolbarSnap(corner, placement) {
    const point = this.toolbarSnapPoint(corner, placement);
    if (!point) {
      this.scheduleApplyToolbarPosition();
      return;
    }

    this.toolbarEl.style.left = `${Math.round(point.left)}px`;
    this.toolbarEl.style.top = `${Math.round(point.top)}px`;
  }

  /*
   * 作用：
   * 计算某个“角落 + 内外侧”对应的 fixed 屏幕坐标。
   */
  toolbarSnapPoint(corner, placement) {
    if (!this.toolbarEl || !this.hostEl) return null;

    const hostRect = this.hostEl.getBoundingClientRect();
    const toolbarRect = this.toolbarEl.getBoundingClientRect();
    if (!hostRect.width || !hostRect.height || !toolbarRect.width || !toolbarRect.height) {
      return null;
    }

    const gap = 8;
    const [vertical, horizontal] = String(corner || '').split('-');
    const isRight = horizontal === 'right';
    const isBottom = vertical === 'bottom';
    const left = isRight ? hostRect.right - toolbarRect.width - gap : hostRect.left + gap;
    let top = isBottom ? hostRect.bottom - toolbarRect.height - gap : hostRect.top + gap;

    if (placement === 'outside') {
      top = isBottom ? hostRect.bottom + gap : hostRect.top - toolbarRect.height - gap;
    }

    const maxLeft = Math.max(gap, window.innerWidth - toolbarRect.width - gap);
    const maxTop = Math.max(gap, window.innerHeight - toolbarRect.height - gap);
    return {
      left: clamp(left, gap, maxLeft),
      top: clamp(top, gap, maxTop),
    };
  }

  /*
   * 作用：
   * 拖动结束后，把当前临时位置吸附到最近的 8 个工具栏位置。
   */
  nearestToolbarSnap() {
    if (!this.toolbarEl) return null;

    const toolbarRect = this.toolbarEl.getBoundingClientRect();
    const currentCenter = {
      x: toolbarRect.left + toolbarRect.width / 2,
      y: toolbarRect.top + toolbarRect.height / 2,
    };
    let best = null;

    for (const corner of TOOLBAR_CORNERS) {
      for (const placement of TOOLBAR_PLACEMENTS) {
        const point = this.toolbarSnapPoint(corner, placement);
        if (!point) continue;

        const centerX = point.left + toolbarRect.width / 2;
        const centerY = point.top + toolbarRect.height / 2;
        const distance = Math.hypot(currentCenter.x - centerX, currentCenter.y - centerY);
        if (!best || distance < best.distance) {
          best = { corner, placement, distance };
        }
      }
    }

    return best;
  }

  /*
   * 作用：
   * 创建工具栏按钮并绑定点击事件。
   *
   * 实现逻辑：
   * 优先使用 Obsidian setIcon；失败时退回文字，避免图标 API 变化导致按钮不可用。
   */
  createToolbarButton(toolbar, label, icon, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yonxao-mindmap-toolbar-button';
    button.setAttribute('aria-label', label);

    try {
      setIcon(button, icon);
    } catch (_error) {
      button.textContent = label;
    }

    toolbar.appendChild(button);
    this.registerDomEvent(button, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      Promise.resolve(onClick()).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
    });
    return button;
  }

  /*
   * 作用：
   * 打开当前代码块的可视化配置弹框。
   *
   * 调用链：
   * createToolbar() -> 配置按钮 click -> openConfigModal() -> ConfigModal.onOpen()。
   */
  openConfigModal() {
    const modal = new ConfigModal(this.plugin.app, {
      t: this.t.bind(this),
      baseConfig: this.plugin?.getGlobalDefaultConfig?.() || {},
      rawConfig: this.documentConfigForSave(this.rawConfig),
      onApply: async (nextConfig) => this.applyConfigFromModal(nextConfig),
    });
    modal.open();
  }

  /*
   * 作用：
   * 保存配置弹框提交的配置，并保留当前正文内容。
   *
   * 实现逻辑：
   * - 源码模式：先解析 textarea，保留用户正在编辑的标题正文，只替换配置区。
   * - 导图模式：以内存树为准重新序列化正文，再写入新的配置区。
   * - 写回成功后刷新运行时配置和当前视图。
   */
  async applyConfigFromModal(nextConfig) {
    const rawConfig = this.documentConfigForSave(nextConfig);
    const shouldWriteConfig = hasMeaningfulConfig(rawConfig);
    let nextRoot = this.root;
    let nextSource;

    if (this.isSourceMode && this.sourceInputEl) {
      let document;

      try {
        document = parseMindDocument(this.composeSourceFromSourceInputs());
      } catch (error) {
        new Notice(`yonxao-mindmap: 源码解析失败，暂未保存配置：${error.message || String(error)}`);
        this.updateSourceStatus('源码解析失败，请修正后再保存配置。');
        return false;
      }

      if (!document.root) {
        new Notice('yonxao-mindmap: 源码为空，暂未保存配置。');
        this.updateSourceStatus('源码为空，暂未保存配置。');
        return false;
      }

      nextRoot = document.root;
      nextSource = serializeMindSource(rawConfig, document.body, shouldWriteConfig);
    } else {
      nextSource = serializeMindDocument(this.root, rawConfig, shouldWriteConfig);
    }

    const saved = await this.saveSourceToMarkdownFile(nextSource);
    if (!saved) return false;

    this.root = nextRoot;
    this.source = nextSource;
    this.rawConfig = canonicalizeMindConfig(rawConfig);
    this.refreshNormalizedConfig();
    this.hasConfigBlock = shouldWriteConfig;
    this.syncSourceInput();
    this.applyRuntimeConfigToView();

    if (this.isSourceMode) {
      this.scheduleSourceModeHeight();
    } else {
      this.renderMap(true);
    }

    new Notice(this.t('notice.configSaved'));
    return true;
  }

  /*
   * 作用：
   * 阻止插件内部事件冒泡到 Obsidian 外层编辑器。
   *
   * 调用链：
   * mount() -> installEventBoundary()。
   */
  installEventBoundary() {
    /*
     * Live Preview 不是普通网页环境：Obsidian 的外层仍然是一个 CodeMirror 编辑器。
     * 如果插件内部的 click / keydown / input 等事件继续向外冒泡，外层编辑器可能会尝试接管焦点、
     * 弹出“编辑这个区块”的内置按钮，或者把 textarea 的按键当成 Markdown 编辑器按键处理。
     *
     * 这里做一个“事件边界”：事件仍然可以在插件内部正常流动，所以工具栏、SVG 主题、源码编辑框都能工作；
     * 但事件到达 yonxao-mindmap 根元素后就停止，不再交给 CodeMirror/Obsidian 的嵌入块控制层。
     * 阅读视图里启用这个边界也没有副作用，因为它只作用于当前导图容器内部。
     */
    for (const eventName of [
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'pointerdown',
      'pointerup',
      'keydown',
      'keyup',
      'input',
      'change',
      'wheel',
    ]) {
      this.registerDomEvent(this.hostEl, eventName, (event) => {
        event.stopPropagation();
      });
    }
  }

  /*
   * 作用：
   * 在源码模式和导图视图之间切换。
   *
   * 实现逻辑：
   * 如果源码模式有未保存内容，切回导图前先尝试保存，保证两种视图状态一致。
   */
  async toggleSourceMode() {
    // 如果用户在源码模式已经改过内容，切回导图前先尝试保存。
    // 这样可以保证“导图视图看到的内容”和“Markdown 文件里的源码”是一致的。
    if (this.isSourceMode && this.sourceDirty) {
      const saved = await this.saveFromSourceView();
      if (!saved) return;
    }

    this.isSourceMode = !this.isSourceMode;
    this.containerEl.classList.toggle('is-source-mode', this.isSourceMode);
    this.hostEl.classList.toggle('is-source-mode', this.isSourceMode);
    this.rememberViewModeConfig();

    // 源码模式只是用来核对 yxmm 文本，缩放/适配这些 SVG 操作在这里禁用掉。
    for (const button of this.mapActionButtons) {
      button.disabled = this.isSourceMode;
    }

    if (this.isSourceMode) {
      this.closeTopicEditor();
      this.syncSourceInput();
      this.scheduleSourceModeHeight();
    } else {
      this.applyConfiguredCanvasHeight();
      this.renderMap(true, { growManualHeight: true });
    }

    this.updateToggleViewButton();
  }

  /*
   * 作用：
   * 强制显示源码模式，并在状态栏展示解析错误或提示。
   *
   * 调用链：
   * mount() 解析失败或源码为空时调用。
   */
  showSourceMode(statusMessage) {
    this.isSourceMode = true;
    this.containerEl.classList.add('is-source-mode');
    this.hostEl.classList.add('is-source-mode');

    for (const button of this.mapActionButtons) {
      button.disabled = true;
    }

    this.closeTopicEditor();
    this.syncSourceInput();
    this.updateSourceStatus(statusMessage);
    this.rememberViewModeConfig();
    this.updateToggleViewButton();
    this.scheduleSourceModeHeight();
  }

  /*
   * 作用：
   * 根据当前模式更新“源码/导图”切换按钮的图标和可访问属性。
   */
  updateToggleViewButton() {
    if (!this.toggleViewButton) return;

    const label = this.isSourceMode ? this.t('toolbar.showMap') : this.t('toolbar.showSource');
    const icon = this.isSourceMode ? 'git-branch' : 'code-2';
    this.toggleViewButton.setAttribute('aria-label', label);
    this.toggleViewButton.setAttribute('aria-pressed', String(this.isSourceMode));
    this.toggleViewButton.textContent = '';

    try {
      setIcon(this.toggleViewButton, icon);
    } catch (_error) {
      this.toggleViewButton.textContent = this.isSourceMode
        ? this.t('toolbar.mapFallback')
        : this.t('toolbar.sourceFallback');
    }
  }

  /*
   * 作用：
   * 更新“适配视图 / 原始大小”切换按钮。
   */
  updateViewFitButton() {
    if (!this.viewFitButton) return;

    const isFit = this.currentViewFitMode === 'fit';
    const label = isFit ? this.t('toolbar.originalSize') : this.t('toolbar.fitView');
    const icon = isFit ? 'minimize' : 'maximize';
    this.viewFitButton.setAttribute('aria-label', label);
    this.viewFitButton.setAttribute('aria-pressed', String(isFit));
    this.viewFitButton.textContent = '';

    try {
      setIcon(this.viewFitButton, icon);
    } catch (_error) {
      this.viewFitButton.textContent = label;
    }
  }

  /*
   * 作用：
   * 根据当前全屏状态更新工具栏全屏按钮。
   */
  updateFullscreenButton() {
    if (!this.fullscreenButton) return;

    const label = this.isFullscreen
      ? this.t('toolbar.exitFullscreen')
      : this.t('toolbar.enterFullscreen');
    const icon = this.isFullscreen ? 'minimize-2' : 'maximize-2';
    this.fullscreenButton.setAttribute('aria-label', label);
    this.fullscreenButton.setAttribute('aria-pressed', String(this.isFullscreen));
    this.fullscreenButton.textContent = '';

    try {
      setIcon(this.fullscreenButton, icon);
    } catch (_error) {
      this.fullscreenButton.textContent = label;
    }
  }

  /*
   * 作用：
   * 切换当前导图宿主的浏览器全屏状态。
   */
  async toggleFullscreen() {
    if (!this.hostEl || typeof document === 'undefined') return;

    if (document.fullscreenElement === this.hostEl) {
      if (typeof document.exitFullscreen === 'function') {
        await document.exitFullscreen();
      }
      return;
    }

    if (typeof this.hostEl.requestFullscreen !== 'function') {
      new Notice('yonxao-mindmap: 当前环境不支持全屏查看。');
      return;
    }

    this.moveToolbarIntoFullscreenHost();
    this.hostEl.classList.add('is-fullscreen');
    try {
      await this.hostEl.requestFullscreen();
    } catch (error) {
      this.hostEl.classList.remove('is-fullscreen');
      this.restoreToolbarToBody();
      throw error;
    }
  }

  /*
   * 作用：
   * 浏览器全屏状态变化后同步 DOM 状态和视图尺寸。
   */
  handleFullscreenChange() {
    if (typeof document === 'undefined') return;

    this.isFullscreen = document.fullscreenElement === this.hostEl;
    this.hostEl?.classList.toggle('is-fullscreen', this.isFullscreen);

    if (this.isFullscreen) {
      this.moveToolbarIntoFullscreenHost();
      this.showToolbar();
    } else {
      this.restoreToolbarToBody();
    }

    this.updateFullscreenButton();
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();
  }

  /*
   * 作用：
   * 全屏某个导图宿主时，body 下的工具栏不会显示；因此临时把它移入宿主。
   */
  moveToolbarIntoFullscreenHost() {
    if (!this.toolbarEl || !this.hostEl || this.toolbarEl.parentElement === this.hostEl) return;

    this.hostEl.appendChild(this.toolbarEl);
  }

  /*
   * 作用：
   * 退出全屏后恢复工具栏的 body 级浮层定位。
   */
  restoreToolbarToBody() {
    if (!this.toolbarEl || typeof document === 'undefined') return;
    if (this.toolbarEl.parentElement === document.body) return;

    document.body.appendChild(this.toolbarEl);
  }

  /*
   * 作用：
   * 创建 SVG 幕布并注册幕布交互事件。
   *
   * 调用链：
   * mount() -> createSvg()；后续 renderMap() 会向 mapEl 写入主题和连线。
   */
  createSvg() {
    this.svgEl = svg('svg', {
      class: 'yonxao-mindmap-svg',
      role: 'img',
      'aria-label': 'Mind map',
      tabindex: '0',
    });
    this.mapEl = svg('g', { class: 'yonxao-mindmap-map' });
    this.svgEl.appendChild(this.mapEl);
    this.containerEl.appendChild(this.svgEl);

    this.registerDomEvent(this.svgEl, 'click', (event) => this.handleTopicClick(event));
    this.registerDomEvent(this.svgEl, 'dblclick', (event) => this.handleTopicDoubleClick(event));
    this.registerDomEvent(this.svgEl, 'contextmenu', (event) => this.handleTopicContextMenu(event));
    this.registerDomEvent(this.svgEl, 'wheel', (event) => this.handleWheel(event));
    this.registerDomEvent(this.svgEl, 'pointerdown', (event) => this.handlePanPointerDown(event));
    this.registerDomEvent(this.svgEl, 'pointermove', (event) => this.handlePanPointerMove(event));
    this.registerDomEvent(this.svgEl, 'pointerup', (event) => this.handlePanPointerUp(event));
    this.registerDomEvent(this.svgEl, 'pointercancel', (event) => this.handlePanPointerUp(event));
  }

  /*
   * 作用：
   * 创建源码模式的 textarea 和保存状态栏。
   *
   * 实现逻辑：
   * textarea 负责真实编辑；保存状态栏提示源码是否已同步回 Markdown。
   */
  createSourceView() {
    this.sourceEl = document.createElement('div');
    this.sourceEl.className = 'yonxao-mindmap-source';

    const tabListEl = document.createElement('div');
    tabListEl.className = 'yonxao-mindmap-source-tabs';
    tabListEl.setAttribute('role', 'tablist');

    this.sourceTabButtons = {
      config: this.createSourceTabButton('config', this.t('source.tab.config')),
      body: this.createSourceTabButton('body', this.t('source.tab.body')),
    };
    tabListEl.appendChild(this.sourceTabButtons.config);
    tabListEl.appendChild(this.sourceTabButtons.body);

    const editorEl = document.createElement('div');
    editorEl.className = 'yonxao-mindmap-source-editor';

    this.sourceConfigInputEl = document.createElement('textarea');
    this.sourceConfigInputEl.className =
      'yonxao-mindmap-source-input yonxao-mindmap-source-config-input';
    this.sourceConfigInputEl.spellcheck = false;
    this.sourceConfigInputEl.wrap = 'off';
    this.sourceConfigInputEl.id = `${this.sourceViewIdPrefix}-config`;
    this.sourceConfigInputEl.setAttribute('aria-label', this.t('source.tab.config'));
    this.sourceConfigInputEl.setAttribute('role', 'tabpanel');

    this.sourceInputEl = document.createElement('textarea');
    this.sourceInputEl.className = 'yonxao-mindmap-source-input yonxao-mindmap-source-body-input';
    this.sourceInputEl.spellcheck = false;
    this.sourceInputEl.wrap = 'off';
    this.sourceInputEl.id = `${this.sourceViewIdPrefix}-body`;
    this.sourceInputEl.setAttribute('aria-label', this.t('source.tab.body'));
    this.sourceInputEl.setAttribute('role', 'tabpanel');

    this.sourceBodyEditorEl = document.createElement('div');
    this.sourceBodyEditorEl.className = 'yonxao-mindmap-source-code-editor';
    this.sourceBodyEditorEl.setAttribute('role', 'presentation');

    const sourceBodyHighlightViewportEl = document.createElement('div');
    sourceBodyHighlightViewportEl.className = 'yonxao-mindmap-source-highlight-viewport';
    this.sourceBodyHighlightEl = document.createElement('div');
    this.sourceBodyHighlightEl.className = 'yonxao-mindmap-source-highlight';
    sourceBodyHighlightViewportEl.appendChild(this.sourceBodyHighlightEl);

    const sourceBodyLineNumberViewportEl = document.createElement('div');
    sourceBodyLineNumberViewportEl.className = 'yonxao-mindmap-source-line-number-viewport';
    this.sourceBodyLineNumbersEl = document.createElement('div');
    this.sourceBodyLineNumbersEl.className = 'yonxao-mindmap-source-line-numbers';
    sourceBodyLineNumberViewportEl.appendChild(this.sourceBodyLineNumbersEl);

    this.sourceBodyEditorEl.appendChild(sourceBodyHighlightViewportEl);
    this.sourceBodyEditorEl.appendChild(sourceBodyLineNumberViewportEl);
    this.sourceBodyEditorEl.appendChild(this.sourceInputEl);

    this.syncSourceInput();
    this.sourceLineCount = this.sourceInputLineCount();

    this.sourceStatusEl = document.createElement('div');
    this.sourceStatusEl.className = 'yonxao-mindmap-source-status';
    this.sourceStatusEl.textContent = this.t('source.status.editable');

    editorEl.appendChild(this.sourceConfigInputEl);
    editorEl.appendChild(this.sourceBodyEditorEl);
    this.sourceEl.appendChild(tabListEl);
    this.sourceEl.appendChild(editorEl);
    this.sourceEl.appendChild(this.sourceStatusEl);
    this.containerEl.appendChild(this.sourceEl);

    this.installSourceInputEvents(this.sourceConfigInputEl, 'config');
    this.installSourceInputEvents(this.sourceInputEl, 'body');
    this.setSourceActiveTab('body', { focus: false });
  }

  /*
   * 作用：
   * 创建源码模式的“配置区 / 正文区”标签按钮。
   */
  createSourceTabButton(tab, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yonxao-mindmap-source-tab';
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `${this.sourceViewIdPrefix}-${tab}`);
    this.registerDomEvent(button, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.setSourceActiveTab(tab, { focus: true });
    });
    return button;
  }

  /*
   * 作用：
   * 注册源码模式 textarea 的输入和保存快捷键。
   */
  installSourceInputEvents(inputEl, tab) {
    this.registerDomEvent(inputEl, 'input', () => {
      this.sourceDirty = this.composeSourceFromSourceInputs() !== this.source;
      this.updateSourceStatus();
      if (tab === 'body') this.updateSourceBodyEditor();
      if (tab === this.sourceActiveTab) {
        this.scheduleSourceModeHeightIfLineCountChanged();
      }
    });

    this.registerDomEvent(inputEl, 'keydown', (event) => {
      if (tab === 'body' && event.key === 'Tab') {
        if (!this.config.source.enableTabIndent) return;
        event.preventDefault();
        applyTopicLevelKey(this.sourceInputEl, event.shiftKey);
        this.sourceDirty = this.composeSourceFromSourceInputs() !== this.source;
        this.updateSourceStatus();
        this.updateSourceBodyEditor();
        this.scheduleSourceModeHeightIfLineCountChanged();
        return;
      }

      // 在 textarea 中拦截 Ctrl/Cmd+S，和桌面应用常见保存体验保持一致。
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        Promise.resolve(this.saveFromSourceView()).catch((error) => {
          new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
        });
      }
    });

    if (tab === 'body') {
      this.registerDomEvent(inputEl, 'scroll', () => this.syncSourceBodyEditorScroll());
      this.registerDomEvent(inputEl, 'click', () => this.updateSourceBodyEditorActiveLine());
      this.registerDomEvent(inputEl, 'keyup', () => this.updateSourceBodyEditorActiveLine());
      this.registerDomEvent(inputEl, 'select', () => this.updateSourceBodyEditorActiveLine());
    }
  }

  /*
   * 作用：
   * 切换源码模式中当前显示的编辑页。
   */
  setSourceActiveTab(tab, options = {}) {
    const nextTab = tab === 'config' ? 'config' : 'body';
    this.sourceActiveTab = nextTab;

    for (const [key, button] of Object.entries(this.sourceTabButtons || {})) {
      const isActive = key === nextTab;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    }

    this.sourceConfigInputEl?.classList.toggle('is-active', nextTab === 'config');
    this.sourceInputEl?.classList.toggle('is-active', nextTab === 'body');
    this.sourceBodyEditorEl?.classList.toggle('is-active', nextTab === 'body');
    this.sourceLineCount = this.sourceInputLineCount();
    this.updateSourceBodyEditor();
    this.scheduleSourceModeHeight();

    if (options.focus) {
      const inputEl = this.activeSourceInputEl();
      inputEl?.focus();
    }
  }

  /*
   * 作用：
   * 创建幕布底部高度拖拽条。
   *
   * 调用链：
   * mount() -> createHeightResizeHandle() -> handleHeightResizePointerDown/Move/Up()。
   */
  createHeightResizeHandle() {
    this.heightResizeHandleEl = document.createElement('div');
    this.heightResizeHandleEl.className = 'yonxao-mindmap-height-resize-handle';
    this.heightResizeHandleEl.setAttribute('role', 'separator');
    this.heightResizeHandleEl.setAttribute('aria-orientation', 'horizontal');
    this.heightResizeHandleEl.setAttribute('aria-label', this.t('canvas.resizeHandle'));
    this.heightResizeHandleEl.setAttribute('title', this.t('canvas.resizeHandle'));
    this.containerEl.appendChild(this.heightResizeHandleEl);

    this.registerDomEvent(this.heightResizeHandleEl, 'pointerdown', (event) => {
      this.handleHeightResizePointerDown(event);
    });
    this.registerDomEvent(this.heightResizeHandleEl, 'pointermove', (event) => {
      this.handleHeightResizePointerMove(event);
    });
    this.registerDomEvent(this.heightResizeHandleEl, 'pointerup', (event) => {
      this.handleHeightResizePointerUp(event);
    });
    this.registerDomEvent(this.heightResizeHandleEl, 'pointercancel', (event) => {
      this.handleHeightResizePointerUp(event);
    });
    this.registerDomEvent(this.heightResizeHandleEl, 'dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.resetManualHeight();
    });
  }

  /*
   * 作用：
   * 开始调整幕布高度，记录拖拽起点和初始高度。
   */
  handleHeightResizePointerDown(event) {
    if (!this.containerEl) return;

    event.preventDefault();
    event.stopPropagation();

    this.heightResizeState = {
      pointerId: event.pointerId,
      clientY: event.clientY,
      startHeight: this.containerEl.getBoundingClientRect().height,
    };
    if (this.isSourceMode) {
      this.manualSourceHeight = true;
    } else {
      this.manualCanvasHeight = true;
    }
    this.containerEl.classList.add('is-resizing');

    try {
      this.heightResizeHandleEl.setPointerCapture(event.pointerId);
    } catch (_error) {
      // 旧版 WebView 可能不支持 Pointer Capture，不影响基本拖拽。
    }
  }

  /*
   * 作用：
   * 根据指针移动距离实时更新容器高度。
   *
   * 实现逻辑：
   * 高度通过 clamp 限制在最小幕布高度和 maxManualHeight 之间。
   */
  handleHeightResizePointerMove(event) {
    if (!this.heightResizeState || !this.containerEl) return;

    event.preventDefault();
    const deltaY = event.clientY - this.heightResizeState.clientY;
    const nextHeight = clamp(
      this.heightResizeState.startHeight + deltaY,
      CANVAS_MIN_HEIGHT,
      this.maxManualHeight()
    );
    this.containerEl.style.height = `${Math.round(nextHeight)}px`;
  }

  /*
   * 作用：
   * 结束高度拖拽条，并释放 pointer capture。
   */
  handleHeightResizePointerUp(event) {
    if (!this.heightResizeState) return;

    try {
      this.heightResizeHandleEl.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 未捕获指针时释放会失败，可以安全忽略。
    }

    this.heightResizeState = null;
    if (this.containerEl) {
      this.containerEl.classList.remove('is-resizing');
      const height = Math.round(this.containerEl.getBoundingClientRect().height);
      this.rawConfig = setMindConfigPath(
        this.rawConfig,
        this.isSourceMode ? ['basic', 'sourceHeight'] : ['basic', 'canvasHeight'],
        height
      );
      this.rememberViewModeConfig();
      Promise.resolve(this.saveRuntimeConfigToFile()).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
    }
  }

  /*
   * 作用：
   * 计算当前窗口下允许的最大手动高度。
   */
  maxManualHeight() {
    const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
    return Math.max(CANVAS_MIN_HEIGHT, Math.min(CANVAS_MAX_HEIGHT, viewportHeight * 1.6));
  }

  /*
   * 作用：
   * 清除手动高度，恢复自动高度。
   */
  resetManualHeight() {
    if (!this.containerEl) return;

    this.manualCanvasHeight = false;
    this.manualSourceHeight = false;
    this.containerEl.style.height = '';
    this.rawConfig = deleteMindConfigPath(
      this.rawConfig,
      this.isSourceMode ? ['basic', 'sourceHeight'] : ['basic', 'canvasHeight']
    );
    this.rememberViewModeConfig();
    Promise.resolve(this.saveRuntimeConfigToFile()).catch((error) => {
      new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
    });
    if (this.isSourceMode) {
      this.scheduleSourceModeHeight();
    } else {
      this.scheduleFitView();
    }
  }

  /*
   * 作用：
   * 用当前 this.source 同步 textarea，并清除源码脏状态。
   */
  syncSourceInput() {
    if (!this.sourceInputEl) return;
    const sections = this.splitSourceForEditor(this.source);
    if (this.sourceConfigInputEl) {
      this.sourceConfigInputEl.value = sections.config;
    }
    this.sourceInputEl.value = sections.body;
    this.sourceLineCount = this.sourceInputLineCount();
    this.sourceDirty = false;
    this.updateSourceBodyEditor();
    this.updateSourceStatus();
  }

  /*
   * 作用：
   * 重建正文区 CodeMirror 风格高亮层和行号层。
   *
   * 设计取舍：
   * 真实编辑仍由 textarea 完成；高亮层只按当前文本生成不可交互的视觉结构。
   */
  updateSourceBodyEditor() {
    if (!this.sourceInputEl || !this.sourceBodyHighlightEl || !this.sourceBodyLineNumbersEl) {
      return;
    }

    const lines = this.sourceInputEl.value.split(/\r?\n/);
    const activeLineIndex = this.sourceInputCursorLineIndex();
    const highlightFragment = document.createDocumentFragment();
    const lineNumberFragment = document.createDocumentFragment();

    lines.forEach((line, index) => {
      const isActive = index === activeLineIndex;

      const lineEl = document.createElement('div');
      lineEl.className = 'yonxao-mindmap-source-highlight-line';
      if (isActive) lineEl.classList.add('is-active-line');
      this.appendSourceBodyHighlightedLine(lineEl, line);
      highlightFragment.appendChild(lineEl);

      const lineNumberEl = document.createElement('div');
      lineNumberEl.className = 'yonxao-mindmap-source-line-number';
      if (isActive) lineNumberEl.classList.add('is-active-line');
      lineNumberEl.textContent = String(index + 1);
      lineNumberFragment.appendChild(lineNumberEl);
    });

    this.sourceBodyHighlightEl.replaceChildren(highlightFragment);
    this.sourceBodyLineNumbersEl.replaceChildren(lineNumberFragment);
    this.syncSourceBodyEditorScroll();
  }

  /*
   * 作用：
   * 只更新当前行状态，不改变源码文本。
   */
  updateSourceBodyEditorActiveLine() {
    if (!this.sourceBodyHighlightEl || !this.sourceBodyLineNumbersEl) return;
    const activeLineIndex = this.sourceInputCursorLineIndex();
    const highlightLines = Array.from(this.sourceBodyHighlightEl.children);
    const lineNumbers = Array.from(this.sourceBodyLineNumbersEl.children);

    highlightLines.forEach((lineEl, index) => {
      lineEl.classList.toggle('is-active-line', index === activeLineIndex);
    });
    lineNumbers.forEach((lineEl, index) => {
      lineEl.classList.toggle('is-active-line', index === activeLineIndex);
    });
  }

  /*
   * 作用：
   * textarea 负责滚动，高亮层和行号层跟随它的滚动偏移。
   */
  syncSourceBodyEditorScroll() {
    if (!this.sourceInputEl || !this.sourceBodyHighlightEl || !this.sourceBodyLineNumbersEl) {
      return;
    }

    this.sourceBodyHighlightEl.style.transform = `translate(${-this.sourceInputEl.scrollLeft}px, ${-this.sourceInputEl.scrollTop}px)`;
    this.sourceBodyLineNumbersEl.style.transform = `translateY(${-this.sourceInputEl.scrollTop}px)`;
  }

  /*
   * 作用：
   * 给正文区一行源码加轻量语法高亮。
   */
  appendSourceBodyHighlightedLine(lineEl, line) {
    const sourceLine = String(line);
    if (!sourceLine) {
      lineEl.appendChild(document.createTextNode('\u200b'));
      return;
    }

    const topicMatch = sourceLine.match(/^(\s*)(#{1,6})(\s+)(.*)$/);
    if (!topicMatch) {
      lineEl.classList.add(sourceLine.trim() ? 'is-continuation' : 'is-blank');
      lineEl.appendChild(document.createTextNode(sourceLine || '\u200b'));
      return;
    }

    const [, indent, marker, gap, rest] = topicMatch;
    lineEl.classList.add('is-topic-line', `is-level-${marker.length}`);
    lineEl.appendChild(document.createTextNode(indent));
    this.appendSourceToken(lineEl, marker, 'yonxao-mindmap-source-token-marker');
    lineEl.appendChild(document.createTextNode(gap));

    const attributeMatch = rest.match(/^(.*?)(\s+\[[^\]]+\])$/);
    if (!attributeMatch) {
      this.appendSourceToken(lineEl, rest || '\u200b', 'yonxao-mindmap-source-token-topic');
      return;
    }

    this.appendSourceToken(lineEl, attributeMatch[1], 'yonxao-mindmap-source-token-topic');
    this.appendSourceToken(lineEl, attributeMatch[2], 'yonxao-mindmap-source-token-attribute');
  }

  appendSourceToken(parentEl, text, className) {
    const spanEl = document.createElement('span');
    spanEl.className = className;
    spanEl.textContent = text;
    parentEl.appendChild(spanEl);
  }

  sourceInputCursorLineIndex() {
    if (!this.sourceInputEl) return 0;
    return (
      this.sourceInputEl.value.slice(0, this.sourceInputEl.selectionStart).split(/\r?\n/).length - 1
    );
  }

  /*
   * 作用：
   * 把完整 yxmm 源码拆成配置区和正文区，供源码模式双标签显示。
   */
  splitSourceForEditor(source) {
    const text = String(source || '');
    const lines = text.split(/\r?\n/);
    const firstContentIndex = lines.findIndex((line) => line.trim() !== '');

    if (firstContentIndex === -1 || lines[firstContentIndex].trim() !== '---') {
      return {
        config: '',
        body: text,
      };
    }

    const endIndex = lines.findIndex(
      (line, index) => index > firstContentIndex && line.trim() === '---'
    );
    if (endIndex === -1) {
      return {
        config: '',
        body: text,
      };
    }

    return {
      config: lines.slice(firstContentIndex + 1, endIndex).join('\n'),
      body: [...lines.slice(0, firstContentIndex), ...lines.slice(endIndex + 1)]
        .join('\n')
        .trimStart(),
    };
  }

  /*
   * 作用：
   * 把源码模式两个编辑区重新组合成完整 yxmm 源码。
   */
  composeSourceFromSourceInputs() {
    const configText = String(this.sourceConfigInputEl?.value || '').trim();
    const bodyText = String(this.sourceInputEl?.value || '').trim();
    if (!configText) return bodyText;

    return ['---', configText, '---', '', bodyText].join('\n').trimEnd();
  }

  /*
   * 作用：
   * 返回源码模式当前可见的 textarea。
   */
  activeSourceInputEl() {
    return this.sourceActiveTab === 'config' && this.sourceConfigInputEl
      ? this.sourceConfigInputEl
      : this.sourceInputEl;
  }

  /*
   * 作用：
   * 更新源码模式底部状态文字。
   */
  updateSourceStatus(message) {
    if (!this.sourceStatusEl) return;

    if (message) {
      this.sourceStatusEl.textContent = message;
      return;
    }

    this.sourceStatusEl.textContent = this.sourceDirty
      ? this.t('source.status.dirty')
      : this.t('source.status.synced');
  }

  /*
   * 作用：
   * 延迟一帧计算源码模式高度。
   *
   * 为什么要延迟：
   * 切换源码模式时，浏览器需要先应用 is-source-mode 样式，源码区的 padding 和状态栏高度才是准确的。
   */
  scheduleSourceModeHeight() {
    if (this.pendingSourceHeightFrame || typeof window === 'undefined') return;

    this.pendingSourceHeightFrame = window.requestAnimationFrame(() => {
      this.pendingSourceHeightFrame = null;
      this.applySourceModeHeight();
    });
  }

  /*
   * 作用：
   * 只有源码行数变化时才重新计算源码模式高度。
   *
   * 为什么这样做：
   * 普通字符输入不会改变源码需要的垂直空间；如果每次输入都重新计算高度，
   * textarea 当前高度又会反过来影响测量结果，导致源码区越输越高。
   */
  scheduleSourceModeHeightIfLineCountChanged() {
    const nextLineCount = this.sourceInputLineCount();
    if (nextLineCount === this.sourceLineCount) return;

    this.sourceLineCount = nextLineCount;
    this.scheduleSourceModeHeight();
  }

  /*
   * 作用：
   * 按源码内容撑开容器高度，让进入源码模式时尽量一次看到完整 yxmm 内容。
   *
   * 实现逻辑：
   * 根据源码行数、行高和 padding 估算内容高度；再加上源码区 padding、状态栏高度和一点余量。
   * 这个高度只是源码模式临时视图高度，不会写入 canvas.height。
   */
  applySourceModeHeight() {
    const activeInputEl = this.activeSourceInputEl();
    if (!this.isSourceMode || !this.containerEl || !this.sourceEl || !activeInputEl) {
      return;
    }

    const configuredHeight = this.config.source.height;
    if (configuredHeight) {
      this.manualSourceHeight = true;
      this.containerEl.style.height = `${Math.round(configuredHeight)}px`;
      return;
    }

    this.manualSourceHeight = false;

    const sourceStyle = window.getComputedStyle(this.sourceEl);
    const inputStyle = window.getComputedStyle(activeInputEl);
    const sourcePadding =
      parseFloat(sourceStyle.paddingTop || '0') + parseFloat(sourceStyle.paddingBottom || '0');
    const sourceGap = parseFloat(sourceStyle.gap || '0');
    const statusHeight = this.sourceStatusEl
      ? this.sourceStatusEl.getBoundingClientRect().height
      : 0;
    const lineHeight = parseFloat(inputStyle.lineHeight || '0') || 20;
    const lineCount = this.sourceInputLineCount();
    const inputPadding =
      parseFloat(inputStyle.paddingTop || '0') + parseFloat(inputStyle.paddingBottom || '0');
    const inputHeight = lineCount * lineHeight + inputPadding;
    const extraSpace = lineHeight * 2;
    const nextHeight = clamp(
      inputHeight + sourcePadding + sourceGap + statusHeight + extraSpace,
      CANVAS_MIN_HEIGHT,
      this.maxManualHeight()
    );

    this.containerEl.style.height = `${Math.round(nextHeight)}px`;
  }

  /*
   * 作用：
   * 统计源码 textarea 的行数。
   */
  sourceInputLineCount() {
    const inputEl = this.activeSourceInputEl();
    if (!inputEl) return 1;
    return Math.max(1, inputEl.value.split(/\r?\n/).length);
  }

  /*
   * 作用：
   * 从源码模式保存用户编辑，并重新解析、重绘导图。
   *
   * 调用链：
   * Ctrl+S/toggleSourceMode() -> saveFromSourceView()。
   */
  async saveFromSourceView() {
    if (!this.sourceInputEl) return false;

    const nextSource = this.composeSourceFromSourceInputs();
    let nextDocument;

    // 保存源码前先解析一次。这样用户写错标题层级或属性时，文件不会被插件写成不可渲染状态。
    try {
      nextDocument = parseMindDocument(nextSource);
    } catch (error) {
      new Notice(`yonxao-mindmap: 源码解析失败：${error.message || String(error)}`);
      this.updateSourceStatus('源码解析失败，请修正后再保存。');
      return false;
    }

    if (!nextDocument.root) {
      new Notice('yonxao-mindmap: 源码为空，未保存。');
      this.updateSourceStatus('源码为空，未保存。');
      return false;
    }

    const saved = await this.saveSourceToMarkdownFile(nextSource);
    if (!saved) return false;

    this.source = nextSource;
    this.root = nextDocument.root;
    this.rawConfig = canonicalizeMindConfig(nextDocument.rawConfig || {});
    this.refreshNormalizedConfig();
    this.hasConfigBlock = nextDocument.hasConfig;
    this.rememberViewModeConfig();
    this.collapsedIds.clear();
    this.sourceDirty = false;
    this.applyRuntimeConfigToView();
    this.updateSourceStatus('源码已保存，并已重新渲染导图。');
    this.scheduleSourceModeHeight();
    this.renderMap(true);
    return true;
  }

  /*
   * 作用：
   * 创建导图主题编辑面板。
   *
   * 实现逻辑：
   * 面板编辑的是内存树主题；保存时统一序列化整棵树，避免局部拼字符串导致层级错误。
   */
  createTopicEditor() {
    // 这个编辑面板属于“导图视图编辑器”。
    // 它不直接编辑 SVG 文本，而是编辑内存中的树主题；保存后再把整棵树序列化回 yxmm 源码。
    this.topicEditorEl = document.createElement('div');
    this.topicEditorEl.className = 'yonxao-mindmap-topic-editor';
    this.topicEditorEl.hidden = true;

    const titleEl = document.createElement('div');
    titleEl.className = 'yonxao-mindmap-topic-editor-title';
    titleEl.textContent = this.t('topicEditor.title');

    const textInput = document.createElement('textarea');
    textInput.className = 'yonxao-mindmap-topic-editor-input yonxao-mindmap-topic-editor-textarea';
    textInput.placeholder = this.t('topicEditor.text');
    const textField = this.createTopicEditorTextField(textInput);

    const colorField = this.createTopicEditorColorField();
    const colorInput = document.createElement('input');
    colorInput.type = 'hidden';
    colorField.appendChild(colorInput);

    const iconPicker = this.createTopicEditorIconPicker();
    const iconInput = document.createElement('input');
    iconInput.type = 'hidden';
    iconPicker.appendChild(iconInput);

    const fontFamilyField = this.createTopicEditorFontFamilyField();
    const fontSizeInput = this.createTopicEditorNumberInput({
      min: FONT_SIZE_MIN,
      max: FONT_SIZE_MAX,
      step: 1,
      placeholder: '14',
    });
    const fontWeightInput = this.createTopicEditorNumberInput({
      min: FONT_WEIGHT_MIN,
      max: FONT_WEIGHT_MAX,
      step: 100,
      placeholder: '400',
    });
    const lineHeightInput = this.createTopicEditorNumberInput({
      min: FONT_LINE_HEIGHT_MIN,
      max: FONT_LINE_HEIGHT_MAX,
      step: 1,
      placeholder: '22',
    });
    const maxWidthInput = this.createTopicEditorNumberInput({
      min: TOPIC_MAX_WIDTH_MIN,
      max: TOPIC_MAX_WIDTH_MAX,
      step: 1,
      placeholder: '240',
    });

    const actions = document.createElement('div');
    actions.className = 'yonxao-mindmap-topic-editor-actions';

    const saveButton = this.createPanelButton(this.t('topicEditor.save'), async () => {
      await this.saveTopicEditor();
    });
    const cancelButton = this.createPanelButton(this.t('topicEditor.cancel'), () => {
      this.closeTopicEditor();
    });

    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);

    this.topicEditorEl.appendChild(titleEl);
    this.topicEditorEl.appendChild(textField);
    this.topicEditorEl.appendChild(createLabeledField(this.t('topicEditor.color'), colorField));
    this.topicEditorEl.appendChild(createLabeledField(this.t('topicEditor.icon'), iconPicker));
    this.topicEditorEl.appendChild(
      createLabeledField(this.t('topicEditor.fontFamily'), fontFamilyField)
    );
    this.topicEditorEl.appendChild(
      createLabeledField(this.t('topicEditor.fontSize'), fontSizeInput)
    );
    this.topicEditorEl.appendChild(
      createLabeledField(this.t('topicEditor.fontWeight'), fontWeightInput)
    );
    this.topicEditorEl.appendChild(
      createLabeledField(this.t('topicEditor.lineHeight'), lineHeightInput)
    );
    this.topicEditorEl.appendChild(
      createLabeledField(this.t('topicEditor.maxWidth'), maxWidthInput)
    );
    this.topicEditorEl.appendChild(actions);
    document.body.appendChild(this.topicEditorEl);

    this.topicEditorFields = {
      text: textInput,
      color: colorInput,
      colorField,
      icon: iconInput,
      iconPicker,
      fontFamily: fontFamilyField._valueInput,
      fontFamilyField,
      fontSize: fontSizeInput,
      fontWeight: fontWeightInput,
      lineHeight: lineHeightInput,
      maxWidth: maxWidthInput,
    };

    for (const eventName of [
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'pointerdown',
      'pointerup',
      'keydown',
      'keyup',
      'input',
      'change',
      'wheel',
    ]) {
      this.registerDomEvent(this.topicEditorEl, eventName, (event) => {
        event.stopPropagation();
      });
    }

    this.registerDomEvent(titleEl, 'pointerdown', (event) => {
      this.startTopicEditorDrag(event);
    });
    this.registerDomEvent(titleEl, 'pointermove', (event) => {
      this.handleTopicEditorDragMove(event);
    });
    this.registerDomEvent(titleEl, 'pointerup', (event) => {
      this.finishTopicEditorDrag(event);
    });
    this.registerDomEvent(titleEl, 'pointercancel', (event) => {
      this.finishTopicEditorDrag(event);
    });

    this.registerDomEvent(textInput, 'keydown', (event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        Promise.resolve(this.saveTopicEditor()).catch((error) => {
          new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
        });
      }
    });

    this.createTopicTextEditor();
  }

  /*
   * 作用：
   * 创建主题文本输入行，左侧标签下方放一个放大编辑按钮。
   */
  createTopicEditorTextField(textInput) {
    const field = document.createElement('div');
    field.className = 'yonxao-mindmap-topic-editor-field yonxao-mindmap-topic-editor-text-control';

    const labelColumn = document.createElement('div');
    labelColumn.className = 'yonxao-mindmap-topic-editor-text-label';

    const labelText = document.createElement('span');
    labelText.textContent = this.t('topicEditor.text');

    const expandButton = document.createElement('button');
    expandButton.type = 'button';
    expandButton.className =
      'yonxao-mindmap-topic-editor-icon-button yonxao-mindmap-topic-editor-text-expand';

    try {
      setIcon(expandButton, 'maximize-2');
    } catch (_error) {
      expandButton.textContent = '...';
    }

    const expandButtonText = document.createElement('span');
    expandButtonText.className = 'yonxao-mindmap-topic-editor-sr-only';
    expandButtonText.textContent = this.t('topicEditor.expandText');
    expandButton.appendChild(expandButtonText);

    labelColumn.appendChild(labelText);
    labelColumn.appendChild(expandButton);
    field.appendChild(labelColumn);
    field.appendChild(textInput);

    this.registerDomEvent(expandButton, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openTopicTextEditor();
    });

    return field;
  }

  /*
   * 作用：
   * 创建用于编辑长主题文本的独立浮层。
   */
  createTopicTextEditor() {
    this.topicTextEditorEl = document.createElement('div');
    this.topicTextEditorEl.className = 'yonxao-mindmap-topic-text-editor';
    this.topicTextEditorEl.hidden = true;

    const titleEl = document.createElement('div');
    titleEl.className = 'yonxao-mindmap-topic-text-editor-title';
    titleEl.textContent = this.t('topicEditor.textEditorTitle');

    const inputEl = document.createElement('textarea');
    inputEl.className = 'yonxao-mindmap-topic-editor-input yonxao-mindmap-topic-text-editor-input';
    inputEl.placeholder = this.t('topicEditor.text');
    inputEl.spellcheck = false;

    const actions = document.createElement('div');
    actions.className = 'yonxao-mindmap-topic-editor-actions';
    const applyButton = this.createPanelButton(this.t('topicEditor.applyText'), () => {
      this.closeTopicTextEditor(true);
    });
    const cancelButton = this.createPanelButton(this.t('topicEditor.cancel'), () => {
      this.closeTopicTextEditor(false);
    });
    actions.appendChild(applyButton);
    actions.appendChild(cancelButton);

    this.topicTextEditorEl.appendChild(titleEl);
    this.topicTextEditorEl.appendChild(inputEl);
    this.topicTextEditorEl.appendChild(actions);
    document.body.appendChild(this.topicTextEditorEl);

    this.topicTextEditorInput = inputEl;

    for (const eventName of [
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'pointerdown',
      'pointerup',
      'keydown',
      'keyup',
      'input',
      'change',
      'wheel',
    ]) {
      this.registerDomEvent(this.topicTextEditorEl, eventName, (event) => {
        event.stopPropagation();
      });
    }

    this.registerDomEvent(titleEl, 'pointerdown', (event) => {
      this.startTopicTextEditorDrag(event);
    });
    this.registerDomEvent(titleEl, 'pointermove', (event) => {
      this.handleTopicTextEditorDragMove(event);
    });
    this.registerDomEvent(titleEl, 'pointerup', (event) => {
      this.finishTopicTextEditorDrag(event);
    });
    this.registerDomEvent(titleEl, 'pointercancel', (event) => {
      this.finishTopicTextEditorDrag(event);
    });
    this.registerDomEvent(inputEl, 'keydown', (event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        this.closeTopicTextEditor(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.closeTopicTextEditor(false);
      }
    });
  }

  /*
   * 作用：
   * 创建主题编辑面板中的字体选择控件。
   *
   * 实现逻辑：
   * 字体预设复用配置弹窗里的分组；空值表示不写主题属性，继续继承上级/全局字体。
   */
  createTopicEditorFontFamilyField() {
    const field = document.createElement('div');
    field.className = 'yonxao-mindmap-topic-editor-font-family';

    const select = document.createElement('select');
    select.className = 'yonxao-mindmap-topic-editor-input';
    this.appendTopicEditorFontOptions(select);

    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.className = 'yonxao-mindmap-topic-editor-input';
    customInput.placeholder = this.t('topicEditor.fontCustomPlaceholder');
    customInput.hidden = true;

    const valueInput = document.createElement('input');
    valueInput.type = 'hidden';

    field.appendChild(select);
    field.appendChild(customInput);
    field.appendChild(valueInput);
    field._select = select;
    field._customInput = customInput;
    field._valueInput = valueInput;

    this.registerDomEvent(select, 'change', () => {
      if (select.value === CUSTOM_FONT_VALUE) {
        customInput.hidden = false;
        valueInput.value = normalizeFontFamilyInput(customInput.value);
        customInput.focus();
        return;
      }

      customInput.hidden = true;
      customInput.value = '';
      customInput.setCustomValidity('');
      valueInput.value = select.value;
    });

    this.registerDomEvent(customInput, 'input', () => {
      const nextValue = normalizeFontFamilyInput(customInput.value);
      if (!isValidFontFamilyInput(nextValue)) {
        customInput.setCustomValidity(this.t('topicEditor.fontFamily.invalid'));
        return;
      }

      customInput.setCustomValidity('');
      valueInput.value = nextValue;
    });

    return field;
  }

  /*
   * 作用：
   * 把字体预设按当前界面语言写入主题编辑面板的字体下拉框。
   */
  appendTopicEditorFontOptions(select) {
    const translate = (key, replacements) => this.t(key, replacements);
    for (const group of getLocalizedFontFamilyGroups(translate)) {
      const groupEl = document.createElement('optgroup');
      groupEl.label = group.group;

      for (const [optionValue, optionLabel] of group.options) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionLabel;
        groupEl.appendChild(option);
      }

      select.appendChild(groupEl);
    }
  }

  /*
   * 作用：
   * 同步编辑面板中的字体下拉、自定义输入框和保存值。
   */
  setTopicEditorFontFamilyValue(value) {
    const fields = this.topicEditorFields;
    if (!fields?.fontFamily || !fields.fontFamilyField) return;

    const fontFamily = String(value || '').trim();
    const select = fields.fontFamilyField._select;
    const customInput = fields.fontFamilyField._customInput;
    fields.fontFamily.value = fontFamily;

    if (!fontFamily) {
      select.value = '';
      customInput.value = '';
      customInput.hidden = true;
      customInput.setCustomValidity('');
      return;
    }

    if (isPresetFontValue(fontFamily)) {
      select.value = fontFamily;
      customInput.value = '';
      customInput.hidden = true;
      customInput.setCustomValidity('');
      return;
    }

    select.value = CUSTOM_FONT_VALUE;
    customInput.value = fontFamily;
    customInput.hidden = false;
    customInput.setCustomValidity(
      isValidFontFamilyInput(fontFamily) ? '' : this.t('topicEditor.fontFamily.invalid')
    );
  }

  /*
   * 作用：
   * 创建主题编辑面板中的数字输入控件。
   */
  createTopicEditorNumberInput({ min, max, step, placeholder }) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'yonxao-mindmap-topic-editor-input';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.placeholder = placeholder;
    return input;
  }

  /*
   * 作用：
   * 创建主题编辑面板中的颜色控件。
   */
  createTopicEditorColorField() {
    const field = document.createElement('div');
    field.className = 'yonxao-mindmap-topic-editor-color';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'yonxao-mindmap-topic-editor-input';
    input.placeholder = '#3b82f6';

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.className = 'yonxao-mindmap-topic-editor-color-picker';
    picker.value = TOPIC_EDITOR_COLOR_SWATCHES[6];

    const swatches = document.createElement('div');
    swatches.className = 'yonxao-mindmap-topic-editor-swatches';
    for (const color of TOPIC_EDITOR_COLOR_SWATCHES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'yonxao-mindmap-topic-editor-swatch';
      button.style.backgroundColor = color;
      button.setAttribute('aria-label', color);
      button.dataset.color = color;
      swatches.appendChild(button);
    }

    field.appendChild(input);
    field.appendChild(picker);
    field.appendChild(swatches);
    field._textInput = input;
    field._colorPicker = picker;

    this.registerDomEvent(input, 'input', () => {
      this.setTopicEditorColorValue(input.value, { updateText: false });
    });
    this.registerDomEvent(picker, 'input', () => {
      this.setTopicEditorColorValue(picker.value);
    });
    this.registerDomEvent(swatches, 'click', (event) => {
      const swatch = event.target?.closest?.('.yonxao-mindmap-topic-editor-swatch');
      if (!swatch) return;
      event.preventDefault();
      this.setTopicEditorColorValue(swatch.dataset.color || '');
    });

    return field;
  }

  /*
   * 作用：
   * 同步编辑面板中的颜色文本、取色器和保存值。
   */
  setTopicEditorColorValue(value, options = {}) {
    const fields = this.topicEditorFields;
    if (!fields?.color || !fields.colorField) return;

    const text = String(value || '').trim();
    fields.color.value = text;
    if (options.updateText !== false) {
      fields.colorField._textInput.value = text;
    }

    if (/^#[0-9a-f]{6}$/i.test(text)) {
      fields.colorField._colorPicker.value = text;
    }
  }

  /*
   * 作用：
   * 创建主题编辑面板中的图标下拉控件。
   */
  createTopicEditorIconPicker() {
    const picker = document.createElement('div');
    picker.className = 'yonxao-mindmap-topic-editor-icon-picker';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yonxao-mindmap-topic-editor-icon-button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'yonxao-mindmap-topic-editor-icon-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'listbox');

    for (const iconName of ['', ...Object.keys(ICON_PATHS)]) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'yonxao-mindmap-topic-editor-icon-option';
      option.dataset.icon = iconName;
      option.setAttribute('role', 'option');
      this.renderTopicEditorIconOption(option, iconName);
      menu.appendChild(option);
    }

    picker.appendChild(button);
    picker.appendChild(menu);
    picker._button = button;
    picker._menu = menu;

    this.registerDomEvent(button, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextOpen = menu.hidden;
      menu.hidden = !nextOpen;
      button.setAttribute('aria-expanded', String(nextOpen));
    });
    this.registerDomEvent(menu, 'click', (event) => {
      const option = event.target?.closest?.('.yonxao-mindmap-topic-editor-icon-option');
      if (!option) return;
      event.preventDefault();
      event.stopPropagation();
      this.setTopicEditorIconValue(option.dataset.icon || '');
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    });

    return picker;
  }

  /*
   * 作用：
   * 渲染图标下拉中的一项。
   */
  renderTopicEditorIconOption(container, iconName) {
    container.textContent = '';
    const preview = document.createElement('span');
    preview.className = 'yonxao-mindmap-topic-editor-icon-preview';
    preview.appendChild(this.createTopicEditorIconSvg(iconName));

    const name = document.createElement('span');
    name.textContent = iconName || this.t('topicEditor.noIcon');

    container.appendChild(preview);
    container.appendChild(name);
  }

  /*
   * 作用：
   * 为 HTML 图标选择器创建一个小 SVG 预览。
   */
  createTopicEditorIconSvg(iconName) {
    const iconSvg = svg('svg', {
      viewBox: '0 0 24 24',
      width: 16,
      height: 16,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });

    const normalized = normalizeIcon(iconName);
    const paths = ICON_PATHS[normalized];
    if (!paths) {
      iconSvg.appendChild(svg('path', { d: 'M5 12h14' }));
      return iconSvg;
    }

    for (const d of paths) {
      iconSvg.appendChild(svg('path', { d }));
    }
    return iconSvg;
  }

  /*
   * 作用：
   * 同步编辑面板中的图标下拉和保存值。
   */
  setTopicEditorIconValue(value) {
    const fields = this.topicEditorFields;
    if (!fields?.icon || !fields.iconPicker) return;

    const iconName = normalizeIcon(value);
    fields.icon.value = iconName;
    this.renderTopicEditorIconOption(fields.iconPicker._button, iconName);
    for (const option of fields.iconPicker._menu.querySelectorAll(
      '.yonxao-mindmap-topic-editor-icon-option'
    )) {
      option.setAttribute('aria-selected', String((option.dataset.icon || '') === iconName));
    }
  }

  /*
   * 作用：
   * 创建主题编辑面板中的普通按钮，并统一错误处理。
   */
  createPanelButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yonxao-mindmap-topic-editor-button';
    button.textContent = label;
    this.registerDomEvent(button, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      Promise.resolve(onClick()).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
    });
    return button;
  }

  /*
   * 作用：
   * 打开主题编辑面板，并把选中主题数据填入表单。
   */
  openTopicEditor(topic) {
    if (!this.canEditMindMap()) return;
    if (!topic || topic._virtual || !this.topicEditorEl || !this.topicEditorFields) {
      return;
    }

    this.closeInlineTextEditor(false);
    this.editingTopicId = topic.id;
    this.topicEditorFields.text.value = topic.text || '';
    this.setTopicEditorColorValue(topic.attributes.color || '');
    this.setTopicEditorIconValue(topic.attributes.icon || '');
    this.setTopicEditorFontFamilyValue(topic.attributes.fontFamily || '');
    this.topicEditorFields.fontSize.value = topic.attributes.fontSize || '';
    this.topicEditorFields.fontWeight.value = topic.attributes.fontWeight || '';
    this.topicEditorFields.lineHeight.value = topic.attributes.lineHeight || '';
    this.topicEditorFields.maxWidth.value = topic.attributes.maxWidth || '';
    this.topicEditorEl.hidden = false;
    this.positionTopicEditor(topic);
    this.topicEditorFields.text.focus();
    this.topicEditorFields.text.select();
  }

  /*
   * 作用：
   * 打开长主题文本编辑浮层。
   */
  openTopicTextEditor() {
    if (!this.topicEditorFields?.text || !this.topicTextEditorEl || !this.topicTextEditorInput) {
      return;
    }

    this.topicTextEditorInput.value = this.topicEditorFields.text.value || '';
    this.topicTextEditorEl.hidden = false;
    this.positionTopicTextEditor();
    this.topicTextEditorInput.focus();
    this.topicTextEditorInput.select();
  }

  /*
   * 作用：
   * 关闭长主题文本编辑浮层；apply 为 true 时把内容回填到主题编辑面板。
   */
  closeTopicTextEditor(apply = false) {
    if (!this.topicTextEditorEl) return;

    if (apply && this.topicEditorFields?.text && this.topicTextEditorInput) {
      this.topicEditorFields.text.value = this.topicTextEditorInput.value;
      this.topicEditorFields.text.focus();
    }

    this.topicTextEditorEl.hidden = true;
    this.topicTextEditorEl.style.left = '';
    this.topicTextEditorEl.style.top = '';
    this.topicTextEditorEl.classList.remove('is-dragging');
    this.topicTextEditorDragState = null;
  }

  /*
   * 作用：
   * 初次打开长文本编辑浮层时放在视口中央。
   */
  positionTopicTextEditor() {
    if (!this.topicTextEditorEl) return;

    const rect = this.topicTextEditorEl.getBoundingClientRect();
    const left = (window.innerWidth - rect.width) / 2;
    const top = (window.innerHeight - rect.height) / 2;
    const position = this.clampTopicTextEditorPosition(left, top, rect);
    this.topicTextEditorEl.style.left = `${Math.round(position.left)}px`;
    this.topicTextEditorEl.style.top = `${Math.round(position.top)}px`;
  }

  /*
   * 作用：
   * 限制长文本编辑浮层停留在视口内。
   */
  clampTopicTextEditorPosition(left, top, rect = null) {
    const gap = 12;
    const panelRect = rect || this.topicTextEditorEl?.getBoundingClientRect();
    const width = panelRect?.width || 520;
    const height = panelRect?.height || 420;
    return {
      left: clamp(left, gap, Math.max(gap, window.innerWidth - width - gap)),
      top: clamp(top, gap, Math.max(gap, window.innerHeight - height - gap)),
    };
  }

  /*
   * 作用：
   * 开始拖动长文本编辑浮层。
   */
  startTopicTextEditorDrag(event) {
    if (event.button !== 0 || !this.topicTextEditorEl || this.topicTextEditorEl.hidden) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = this.topicTextEditorEl.getBoundingClientRect();
    this.topicTextEditorDragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    this.topicTextEditorEl.classList.add('is-dragging');

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (_error) {
      // Pointer Capture 不可用时仍可在标题栏范围内拖动。
    }
  }

  /*
   * 作用：
   * 处理长文本编辑浮层拖动。
   */
  handleTopicTextEditorDragMove(event) {
    const state = this.topicTextEditorDragState;
    if (!state || event.pointerId !== state.pointerId || !this.topicTextEditorEl) return;

    event.preventDefault();
    event.stopPropagation();

    const nextLeft = state.startLeft + event.clientX - state.startClientX;
    const nextTop = state.startTop + event.clientY - state.startClientY;
    const position = this.clampTopicTextEditorPosition(nextLeft, nextTop);
    this.topicTextEditorEl.style.left = `${Math.round(position.left)}px`;
    this.topicTextEditorEl.style.top = `${Math.round(position.top)}px`;
  }

  /*
   * 作用：
   * 结束长文本编辑浮层拖动。
   */
  finishTopicTextEditorDrag(event) {
    const state = this.topicTextEditorDragState;
    if (!state || event.pointerId !== state.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 没有捕获到指针时释放会失败，这里安全忽略。
    }

    this.topicTextEditorDragState = null;
    this.topicTextEditorEl?.classList.remove('is-dragging');
  }

  /*
   * 作用：
   * 把主题编辑面板定位到当前主题附近。
   */
  positionTopicEditor(topic) {
    if (!this.topicEditorEl || !this.mapEl || !topic) return;

    const topicEl = Array.from(this.mapEl.querySelectorAll('.yonxao-mindmap-topic')).find(
      (element) => element.getAttribute('data-topic-id') === topic.id
    );
    const cardEl = topicEl ? topicEl.querySelector('.yonxao-mindmap-topic-card') : null;
    if (!cardEl) return;

    const gap = 12;
    const cardRect = cardEl.getBoundingClientRect();
    const editorRect = this.topicEditorEl.getBoundingClientRect();
    const rightLeft = cardRect.right + gap;
    const rightFits = rightLeft + editorRect.width + gap <= window.innerWidth;
    let left = rightFits ? rightLeft : cardRect.left;
    let top = rightFits ? cardRect.top : cardRect.bottom + gap;

    ({ left, top } = this.clampTopicEditorPosition(left, top, editorRect));

    this.topicEditorEl.style.left = `${Math.round(left)}px`;
    this.topicEditorEl.style.top = `${Math.round(top)}px`;
  }

  /*
   * 作用：
   * 把 body 级主题编辑浮层限制在当前窗口可视区域内。
   */
  clampTopicEditorPosition(left, top, rect = null) {
    const gap = 12;
    const editorRect = rect || this.topicEditorEl?.getBoundingClientRect();
    const width = editorRect?.width || 300;
    const height = editorRect?.height || 320;
    const maxLeft = Math.max(gap, window.innerWidth - width - gap);
    const maxTop = Math.max(gap, window.innerHeight - height - gap);
    return {
      left: clamp(left, gap, maxLeft),
      top: clamp(top, gap, maxTop),
    };
  }

  /*
   * 作用：
   * 主题编辑面板标题栏作为拖拽手柄，记录拖动起点。
   */
  startTopicEditorDrag(event) {
    if (event.button !== 0 || !this.topicEditorEl || this.topicEditorEl.hidden) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = this.topicEditorEl.getBoundingClientRect();
    this.topicEditorDragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    this.topicEditorEl.classList.add('is-dragging');

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (_error) {
      // Pointer Capture 在少数环境可能不可用；拖拽仍可在标题栏范围内继续。
    }
  }

  /*
   * 作用：
   * 处理主题编辑面板拖拽移动。
   */
  handleTopicEditorDragMove(event) {
    const state = this.topicEditorDragState;
    if (!state || event.pointerId !== state.pointerId || !this.topicEditorEl) return;

    event.preventDefault();
    event.stopPropagation();

    const nextLeft = state.startLeft + event.clientX - state.startClientX;
    const nextTop = state.startTop + event.clientY - state.startClientY;
    const { left, top } = this.clampTopicEditorPosition(nextLeft, nextTop);
    this.topicEditorEl.style.left = `${Math.round(left)}px`;
    this.topicEditorEl.style.top = `${Math.round(top)}px`;
  }

  /*
   * 作用：
   * 结束主题编辑面板拖拽。
   */
  finishTopicEditorDrag(event) {
    const state = this.topicEditorDragState;
    if (!state || event.pointerId !== state.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 没有捕获到指针时释放会失败，这里安全忽略。
    }

    this.topicEditorDragState = null;
    this.topicEditorEl?.classList.remove('is-dragging');
  }

  /*
   * 作用：
   * 关闭主题编辑面板并清理当前编辑主题 id。
   */
  closeTopicEditor() {
    this.editingTopicId = null;
    this.closeTopicTextEditor(false);
    if (this.topicEditorEl) {
      this.topicEditorEl.hidden = true;
      this.topicEditorEl.style.left = '';
      this.topicEditorEl.style.top = '';
      this.topicEditorEl.classList.remove('is-dragging');
    }
    this.topicEditorDragState = null;
    if (this.topicEditorFields?.text) {
      this.topicEditorFields.text.style.width = '';
      this.topicEditorFields.text.style.height = '';
    }
    if (this.topicEditorFields?.iconPicker?._menu) {
      this.topicEditorFields.iconPicker._menu.hidden = true;
      this.topicEditorFields.iconPicker._button.setAttribute('aria-expanded', 'false');
    }
  }

  /*
   * 作用：
   * 在主题附近覆盖一个放大的多行文本框，用于“双击直接改主题文字”。
   *
   * 为什么这样实现：
   * 这个编辑框仍然保持“就地快速编辑”的轻量手感，但尺寸比主题卡片更宽裕，
   * 避免主题较窄或多行文本时内容显示不全。
   *
   * 调用链：
   * handleTopicDoubleClick() -> openInlineTextEditor() -> saveInlineTextEditor() ->
   * saveTreeToSourceAndFile() -> serializeMindDocument()/saveSourceToMarkdownFile()。
   */
  openInlineTextEditor(topic) {
    if (!this.canEditMindMap()) return;
    if (!topic || topic._virtual) return;

    this.closeTopicEditor();
    this.closeInlineTextEditor(false);

    const topicEl = Array.from(this.mapEl.querySelectorAll('.yonxao-mindmap-topic')).find(
      (element) => element.getAttribute('data-topic-id') === topic.id
    );
    const cardEl = topicEl ? topicEl.querySelector('.yonxao-mindmap-topic-card') : null;
    if (!cardEl) return;

    const cardRect = cardEl.getBoundingClientRect();
    const box = topic._layout;

    const inputEl = document.createElement('textarea');
    inputEl.className = 'yonxao-mindmap-inline-text-editor';
    inputEl.value = topic.text || '';
    inputEl.spellcheck = false;
    inputEl.setAttribute('aria-label', this.t('topicEditor.editTextAria'));

    // 编辑框使用固定 UI 字号，不跟随主题字号缩放；大字号主题直接继承会让浮层过大、阅读别扭。
    if (box && box.font) {
      inputEl.style.fontFamily = box.font.family;
    }

    for (const eventName of [
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'pointerdown',
      'pointerup',
      'keydown',
      'keyup',
      'input',
      'change',
      'wheel',
    ]) {
      inputEl.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    }

    inputEl.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        Promise.resolve(this.saveInlineTextEditor()).catch((error) => {
          new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
        });
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeInlineTextEditor(false);
      }
    });

    inputEl.addEventListener('blur', () => {
      if (this.inlineTextEditorSaving) return;
      Promise.resolve(this.saveInlineTextEditor()).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
    });

    document.body.appendChild(inputEl);
    this.inlineTextEditorEl = inputEl;
    this.inlineTextEditorInput = inputEl;
    this.inlineEditingTopicId = topic.id;
    this.positionInlineTextEditor(cardRect, topic, box);
    inputEl.focus();
    inputEl.select();
  }

  /*
   * 作用：
   * 把双击编辑文本框放在主题附近，并按字号、行高和内容量放大。
   */
  positionInlineTextEditor(anchorRect, topic, box) {
    if (!this.inlineTextEditorEl) return;

    const gap = 12;
    const lineHeight = 22;
    const lineCount = Math.max(
      3,
      box?.lines?.length || String(topic?.text || '').split(/\r?\n/).length || 1
    );
    const width = clamp(
      Math.max(anchorRect.width + 120, 240),
      180,
      Math.max(180, window.innerWidth - gap * 2)
    );
    const height = clamp(
      Math.max(anchorRect.height + 44, lineCount * lineHeight + 34),
      86,
      Math.max(86, window.innerHeight - gap * 2)
    );
    const left = anchorRect.left - Math.max(0, (width - anchorRect.width) / 2);
    const top = anchorRect.top - Math.max(0, (height - anchorRect.height) / 2);
    const position = {
      left: clamp(left, gap, Math.max(gap, window.innerWidth - width - gap)),
      top: clamp(top, gap, Math.max(gap, window.innerHeight - height - gap)),
    };
    this.inlineTextEditorEl.style.width = `${Math.round(width)}px`;
    this.inlineTextEditorEl.style.height = `${Math.round(height)}px`;
    this.inlineTextEditorEl.style.left = `${Math.round(position.left)}px`;
    this.inlineTextEditorEl.style.top = `${Math.round(position.top)}px`;
  }

  /*
   * 作用：
   * 保存内联 textarea 中的主题文字，并同步回当前 yxmm 源码。
   *
   * 实现逻辑：
   * 只更新 topic.text，不碰颜色、图标、布局等主题属性；这样双击编辑就是“快速改名”，
   * 完整属性仍然交给铅笔按钮打开的主题编辑面板。
   */
  async saveInlineTextEditor() {
    if (!this.canEditMindMap()) return false;

    const inputEl = this.inlineTextEditorInput;
    const topic = this.topicById.get(this.inlineEditingTopicId);
    if (!inputEl || !topic) return false;

    const nextText = normalizeTopicTextForStorage(inputEl.value);
    if (!nextText) {
      new Notice(this.t('notice.topicTextRequired'));
      inputEl.focus();
      return false;
    }

    if (nextText === (topic.text || '')) {
      this.closeInlineTextEditor(false);
      return true;
    }

    this.inlineTextEditorSaving = true;
    topic.text = nextText;
    this.closeInlineTextEditor(false);

    try {
      return await this.saveTreeToSourceAndFile(this.t('notice.topicTextSaved'));
    } finally {
      this.inlineTextEditorSaving = false;
    }
  }

  /*
   * 作用：
   * 移除内联文字编辑框，并清理双击编辑状态。
   *
   * 参数说明：
   * saveOnClose 预留给后续扩展；当前 blur/Enter 已经直接调用 saveInlineTextEditor，
   * Escape 和重绘场景传 false 表示只关闭不保存。
   */
  closeInlineTextEditor(saveOnClose = false) {
    if (saveOnClose && this.inlineTextEditorEl) {
      Promise.resolve(this.saveInlineTextEditor()).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
      return;
    }

    const editorEl = this.inlineTextEditorEl;
    this.inlineTextEditorEl = null;
    this.inlineTextEditorInput = null;
    this.inlineEditingTopicId = null;
    if (editorEl?.parentNode) {
      editorEl.parentNode.removeChild(editorEl);
    }
  }

  /*
   * 作用：
   * 保存主题编辑面板中的文本、颜色、图标、字体和最大宽度。
   */
  async saveTopicEditor() {
    if (!this.canEditMindMap()) return false;

    const topic = this.topicById.get(this.editingTopicId);
    if (!topic || !this.topicEditorFields) return false;

    const text = normalizeTopicTextForStorage(this.topicEditorFields.text.value);
    if (!text) {
      new Notice(this.t('notice.topicTextRequired'));
      return false;
    }

    for (const field of [
      this.topicEditorFields.fontSize,
      this.topicEditorFields.fontWeight,
      this.topicEditorFields.lineHeight,
      this.topicEditorFields.maxWidth,
    ]) {
      if (field.value && !field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }

    const customFontInput = this.topicEditorFields.fontFamilyField?._customInput;
    if (customFontInput && !customFontInput.hidden && !customFontInput.checkValidity()) {
      customFontInput.reportValidity();
      return false;
    }

    topic.text = text;
    setOptionalTopicAttribute(topic.attributes, 'color', this.topicEditorFields.color.value);
    setOptionalTopicAttribute(topic.attributes, 'icon', this.topicEditorFields.icon.value);
    setOptionalTopicAttribute(
      topic.attributes,
      'fontFamily',
      this.topicEditorFields.fontFamily.value
    );
    setOptionalTopicAttribute(topic.attributes, 'fontSize', this.topicEditorFields.fontSize.value);
    setOptionalTopicAttribute(
      topic.attributes,
      'fontWeight',
      this.topicEditorFields.fontWeight.value
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'lineHeight',
      this.topicEditorFields.lineHeight.value
    );
    setOptionalTopicAttribute(topic.attributes, 'maxWidth', this.topicEditorFields.maxWidth.value);
    setOptionalTopicAttribute(topic.attributes, 'layout', '');

    const saved = await this.saveTreeToSourceAndFile('主题已保存。');
    if (saved) this.closeTopicEditor();
    return saved;
  }

  /*
   * 作用：
   * 在当前编辑主题下新增一个子主题并保存。
   */
  async addSubtopicFromTopicEditor() {
    if (!this.canEditMindMap()) return false;

    const topic = this.topicById.get(this.editingTopicId);
    if (!topic) return false;

    // 新增子主题时只改树结构，不直接拼字符串。统一走 serializeMind，可以避免标题层级出错。
    const subtopic = createMindTopic('新主题', {}, [], 0, (topic.level || 1) + 1);
    topic.subtopics.push(subtopic);
    this.collapsedIds.delete(topic.id);
    assignIds(this.root, '0');

    const saved = await this.saveTreeToSourceAndFile(this.t('notice.subtopicAdded'));
    if (saved) {
      this.openTopicEditor(subtopic);
    }
    return saved;
  }

  /*
   * 作用：
   * 从右键菜单新增子主题。
   *
   * 和编辑面板新增子主题的区别：
   * 右键菜单不依赖当前打开的编辑面板，而是直接使用菜单命中的主题。
   * 保存成功后立即进入内联改名，让用户可以顺手把“新主题”改成真实内容。
   */
  async addSubtopicFromContextMenu(topic) {
    if (!this.canEditMindMap()) return false;
    if (!topic || topic._virtual) return false;

    const subtopic = createMindTopic('新主题', {}, [], 0, (topic.level || 1) + 1);
    topic.subtopics.push(subtopic);
    this.collapsedIds.delete(topic.id);
    assignIds(this.root, '0');

    const saved = await this.saveTreeToSourceAndFile(this.t('notice.subtopicAdded'));
    if (saved) {
      this.openInlineTextEditor(subtopic);
    }
    return saved;
  }

  /*
   * 作用：
   * 从右键菜单在当前主题上方或下方新增兄弟主题。
   *
   * 实现逻辑：
   * 兄弟主题需要插入到父主题 subtopics 数组的相邻位置，所以具体插入由
   * topicTreeActions.insertSiblingTopic 负责；渲染器只负责创建主题、保存和进入改名。
   */
  async addSiblingFromContextMenu(topic, position) {
    if (!this.canEditMindMap()) return false;
    if (!topic || topic === this.root || topic._virtual) return false;

    const sibling = createMindTopic('新主题', {}, [], 0, topic.level || 1);
    const inserted = insertSiblingTopic(this.root, topic.id, sibling, position);
    if (!inserted) {
      new Notice(this.t('notice.rootCannotAddSibling'));
      return false;
    }

    assignIds(this.root, '0');
    const saved = await this.saveTreeToSourceAndFile(this.t('notice.siblingTopicAdded'));
    if (saved) {
      this.openInlineTextEditor(sibling);
    }
    return saved;
  }

  /*
   * 作用：
   * 删除当前编辑主题并保存。
   *
   * 实现逻辑：
   * 根主题和虚拟根不能删除，避免生成空树或破坏多根结构。
   */
  async deleteTopicFromEditor() {
    if (!this.canEditMindMap()) return false;

    const topic = this.topicById.get(this.editingTopicId);
    if (!topic || topic === this.root || topic._virtual) {
      new Notice(this.t('notice.rootCannotDeleteInMap'));
      return false;
    }

    if (!this.confirmDeleteTopic(topic)) return false;

    const removed = removeTopicById(this.root, topic.id);
    if (!removed) return false;

    assignIds(this.root, '0');
    const saved = await this.saveTreeToSourceAndFile(this.t('notice.topicDeleted'));
    if (saved) this.closeTopicEditor();
    return saved;
  }

  /*
   * 作用：
   * 从右键菜单删除主题。
   *
   * 关键点：
   * 删除主题不可撤销，所以无论是否存在子主题都先弹出浏览器确认框。
   * 这里使用 window.confirm 是为了保持实现轻量，后续如果需要更精致的 UI 可以替换为 Obsidian Modal。
   */
  async deleteTopicFromContextMenu(topic) {
    if (!this.canEditMindMap()) return false;

    if (!topic || topic === this.root || topic._virtual) {
      new Notice(this.t('notice.rootCannotDelete'));
      return false;
    }

    if (!this.confirmDeleteTopic(topic)) return false;

    this.closeTopicEditor();
    this.closeInlineTextEditor(false);
    const removed = removeTopicById(this.root, topic.id);
    if (!removed) return false;

    assignIds(this.root, '0');
    return this.saveTreeToSourceAndFile(this.t('notice.topicDeleted'));
  }

  /*
   * 作用：
   * 删除主题前统一二次确认。
   *
   * 调用链：
   * deleteTopicFromEditor()/deleteTopicFromContextMenu() -> confirmDeleteTopic()。
   *
   * 实现逻辑：
   * 普通主题也确认；有后代主题时额外提示会同时删除多少个子主题。
   */
  confirmDeleteTopic(topic) {
    const descendantCount = countTopicDescendants(topic);
    const message =
      descendantCount > 0
        ? this.t('confirm.deleteTopicWithDescendants', {
            topic: topic.text,
            count: descendantCount,
          })
        : this.t('confirm.deleteTopic', { topic: topic.text });

    return window.confirm(message);
  }

  /*
   * 作用：
   * 把内存树序列化为源码，并写回 Markdown 文件或编辑器上下文。
   *
   * 调用链：
   * saveTopicEditor/addSubtopic/delete -> saveTreeToSourceAndFile()。
   */
  async saveTreeToSourceAndFile(successMessage) {
    // 导图编辑的保存流程：
    // 1. 当前内存里的 root 已经被修改。
    // 2. serializeMindDocument(root, rawConfig) 把配置区和树重新变成 yxmm 文本。
    // 3. saveSourceToMarkdownFile(nextSource) 只替换当前 Markdown 文件里的这个代码块内容。
    // 4. 更新 textarea，保证源码模式立刻看到导图编辑后的结果。
    assignIds(this.root, '0');
    const nextSource = serializeMindDocument(
      this.root,
      this.documentConfigForSave(this.rawConfig),
      this.hasConfigBlock
    );
    const saved = await this.saveSourceToMarkdownFile(nextSource);
    if (!saved) return false;

    this.source = nextSource;
    this.rawConfig = this.documentConfigForSave(this.rawConfig);
    this.refreshNormalizedConfig();
    this.syncSourceInput();
    this.renderMap(true);
    new Notice(`yonxao-mindmap: ${successMessage || '已保存。'}`);
    return true;
  }

  /*
   * 作用：
   * 只保存运行时配置，不改变主题树正文。
   *
   * 调用场景：
   * 高度拖拽条、工具栏位置拖拽这类交互只更新配置区。
   */
  async saveRuntimeConfigToFile() {
    const runtimeDocument = this.buildRuntimeDocumentForSave();
    if (!runtimeDocument) return false;

    if (runtimeDocument.root) {
      this.root = runtimeDocument.root;
    }
    this.rawConfig = this.documentConfigForSave(runtimeDocument.rawConfig);
    this.refreshNormalizedConfig();
    this.hasConfigBlock = hasMeaningfulConfig(this.rawConfig);
    const nextSource = serializeMindSource(
      this.rawConfig,
      runtimeDocument.body,
      this.hasConfigBlock
    );
    const saved = await this.saveSourceToMarkdownFile(nextSource);
    if (!saved) return false;

    this.source = nextSource;
    this.syncSourceInput();
    return true;
  }

  /*
   * 作用：
   * 生成“只保存配置”时要写回的源码片段。
   *
   * 关键点：
   * 如果当前在源码模式，textarea 里可能有尚未点击保存的内容。
   * 工具栏拖动或高度调整只想保存运行时配置，但不能用旧 root 覆盖用户正在编辑的源码。
   */
  buildRuntimeDocumentForSave() {
    if (this.isSourceMode && this.sourceInputEl) {
      try {
        const document = parseMindDocument(this.composeSourceFromSourceInputs());
        return {
          root: document.root,
          body: document.body,
          rawConfig: this.mergeRuntimeConfig(document.rawConfig || {}, this.rawConfig),
        };
      } catch (error) {
        new Notice(`yonxao-mindmap: 源码解析失败，暂未保存配置：${error.message || String(error)}`);
        return null;
      }
    }

    return {
      root: null,
      body: serializeMindDocument(this.root, {}, false),
      rawConfig: this.documentConfigForSave(this.rawConfig),
    };
  }

  /*
   * 作用：
   * 把运行时配置覆盖到源码模式刚解析出的配置上。
   *
   * 实现逻辑：
   * 源码 textarea 里的用户配置是基础；拖动工具栏和高度调整是本次交互产生的新值。
   */
  mergeRuntimeConfig(baseConfig, runtimeConfig) {
    const next = mergeMindConfigObjects(
      canonicalizeMindConfig(baseConfig),
      canonicalizeMindConfig(runtimeConfig)
    );
    delete next.view;
    return next;
  }

  /*
   * 作用：
   * 生成写回 Markdown 的配置对象，移除只属于当前会话或旧实验配置的字段。
   */
  documentConfigForSave(config) {
    let next = canonicalizeMindConfig(config || {});
    next = deleteMindConfigPath(next, ['view', 'mode']);
    next = deleteMindConfigPath(next, ['toolbar', 'x']);
    next = deleteMindConfigPath(next, ['toolbar', 'y']);
    next = this.pruneDocumentConfigDefaults(next);
    return next;
  }

  /*
   * 作用：
   * 删除与当前全局默认配置一致的文档配置项，让代码块配置区只保存真正的覆盖项。
   *
   * 关键点：
   * 全局配置面板不走 renderer.documentConfigForSave()，所以这里不会清理插件级默认配置本身。
   */
  pruneDocumentConfigDefaults(config) {
    const globalDefaultConfig = this.plugin?.getGlobalDefaultConfig?.() || {};
    const normalizedGlobal = normalizeMindConfig(globalDefaultConfig);
    const normalizedDocument = normalizeMindConfig(this.buildEffectiveRawConfig(config));
    let next = config || {};

    for (const path of this.documentConfigDefaultPrunePaths(next)) {
      const currentValue = this.normalizedConfigValueForPath(normalizedDocument, path);
      const defaultValue = this.normalizedDefaultValueForPath(normalizedGlobal, path);
      if (this.areConfigValuesEqual(currentValue, defaultValue)) {
        next = deleteMindConfigPath(next, path);
      }
    }

    return next;
  }

  /*
   * 作用：
   * 返回需要按全局默认值清理的配置路径；层级字体和层级主题宽度按文档当前已有层级动态补充。
   */
  documentConfigDefaultPrunePaths(config) {
    const paths = [...DOCUMENT_CONFIG_DEFAULT_PRUNE_PATHS];
    const font = config?.font;
    const topicMaxWidth = config?.layout?.topicMaxWidth;

    if (this.isPlainConfigObject(font)) {
      for (const levelKey of ['level1', 'level2', 'level3']) {
        if (!this.isPlainConfigObject(font[levelKey])) continue;
        paths.push(
          ['font', levelKey, 'family'],
          ['font', levelKey, 'size'],
          ['font', levelKey, 'weight'],
          ['font', levelKey, 'lineHeight']
        );
      }
    }

    if (this.isPlainConfigObject(topicMaxWidth)) {
      for (const levelKey of ['level1', 'level2', 'level3']) {
        if (topicMaxWidth[levelKey] !== undefined) {
          paths.push(['layout', 'topicMaxWidth', levelKey]);
        }
      }
    }

    return paths;
  }

  /*
   * 作用：
   * 读取规范化后的配置路径值；层级覆盖没有设置时回退到对应全局值。
   */
  normalizedConfigValueForPath(config, path) {
    if (path[0] === 'font' && /^level[123]$/.test(path[1]) && path.length === 3) {
      const level = path[1].replace('level', '');
      const key = path[2];
      const levelConfig = config.font?.levels?.[level];
      if (this.isPlainConfigObject(levelConfig) && levelConfig[key] !== undefined) {
        return levelConfig[key];
      }
      return config.font?.[key];
    }

    if (path[0] === 'layout' && path[1] === 'topicMaxWidth' && /^level[123]$/.test(path[2])) {
      const level = path[2].replace('level', '');
      const levelConfig = config.topic?.levels?.[level];
      if (this.isPlainConfigObject(levelConfig) && levelConfig.maxWidth !== undefined) {
        return levelConfig.maxWidth;
      }
      return config.topic?.maxWidth;
    }

    const normalizedPathMap = {
      'basic.canvasHeight': ['canvas', 'height'],
      'basic.sourceHeight': ['source', 'height'],
      'basic.tabIndent': ['source', 'enableTabIndent'],
      'basic.toolbar.corner': ['toolbar', 'corner'],
      'basic.toolbar.placement': ['toolbar', 'placement'],
      'basic.viewFit': ['view', 'fit'],
      'basic.wheelZoom': ['interaction', 'wheelZoom'],
      'theme.scheme': ['theme'],
      'theme.defaultTopicColor': ['topic', 'defaultColor'],
      'layout.type': ['layout'],
      'layout.connectorStyle': ['connector', 'style'],
      'layout.branchExpansion': ['branch', 'expansion'],
      'layout.topicMaxWidth.global': ['topic', 'maxWidth'],
    };
    const mappedPath = normalizedPathMap[path.join('.')];
    if (mappedPath) return this.configValueAtPath(config, mappedPath);

    return this.configValueAtPath(config, path);
  }

  /*
   * 作用：
   * 读取全局默认配置路径值；层级覆盖没有默认值时回退到对应全局值。
   */
  normalizedDefaultValueForPath(config, path) {
    return this.normalizedConfigValueForPath(config, path);
  }

  /*
   * 作用：
   * 按路径读取对象值。
   */
  configValueAtPath(config, path) {
    let current = config;
    for (const key of path) {
      if (!current || typeof current !== 'object') return undefined;
      current = current[key];
    }
    return current;
  }

  /*
   * 作用：
   * 判断两个配置值是否一致。
   */
  areConfigValuesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  /*
   * 作用：
   * 判断配置片段是否为普通对象。
   */
  isPlainConfigObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  /*
   * 作用：
   * 构建当前渲染真正使用的 raw config。
   *
   * 配置优先级：
   * 插件全局默认配置 < 当前文档配置区 < 主题属性。
   *
   * 注意：
   * 这里不会把全局默认配置写回 rawConfig，因为 rawConfig 表示当前文档自己的配置区。
   */
  buildEffectiveRawConfig(documentConfig = this.rawConfig) {
    const globalDefaultConfig = this.plugin?.getGlobalDefaultConfig?.() || {};
    return mergeMindConfigObjects(
      canonicalizeMindConfig(globalDefaultConfig),
      canonicalizeMindConfig(documentConfig || {})
    );
  }

  /*
   * 作用：
   * rawConfig 或插件全局默认配置变化后刷新运行时配置。
   */
  refreshNormalizedConfig() {
    this.config = normalizeMindConfig(this.buildEffectiveRawConfig(this.rawConfig));
  }

  /*
   * 作用：
   * 插件偏好设置中的全局默认配置保存后，刷新当前渲染器。
   *
   * 关键点：
   * 只重新计算运行时配置和视图，不修改当前 Markdown 代码块源码。
   */
  applyGlobalDefaultConfig() {
    this.refreshNormalizedConfig();
    this.applyRuntimeConfigToView();

    if (this.isSourceMode) {
      this.scheduleSourceModeHeight();
      return;
    }

    this.renderMap(true);
  }

  /*
   * 作用：
   * 渲染器内部统一翻译入口。
   */
  t(key, replacements) {
    return this.plugin?.t?.(key, replacements) || key;
  }

  /*
   * 作用：
   * 把新的 yxmm 源码保存回当前 Markdown 文件。
   *
   * 实现逻辑：
   * Live Preview 自定义上下文走编辑器 dispatch；阅读视图走 vault.read/modify。
   */
  async saveSourceToMarkdownFile(nextSource) {
    if (this.editorContext) {
      return this.saveSourceToEditor(nextSource);
    }

    // 这里是真正“落盘”的地方。
    // 注意：插件渲染出来的 DOM/SVG 只是阅读模式里的界面，改 DOM 并不会自动修改 .md 文件。
    // 要保存，必须使用 Obsidian 的 vault API 读取并修改当前 Markdown 文件。
    const file = this.getMarkdownFile();
    if (!file) {
      new Notice('yonxao-mindmap: 找不到当前 Markdown 文件，无法保存。');
      return false;
    }

    // sectionInfo 是 Obsidian 对“当前渲染片段”的定位信息。
    // 代码块保存时最怕改错同文件里的另一个 yxmm，所以先用 sectionInfo 缩小查找范围。
    const sectionInfo =
      this.ctx && typeof this.ctx.getSectionInfo === 'function'
        ? this.ctx.getSectionInfo(this.hostEl)
        : null;

    // vault.read / vault.modify 是 Obsidian 官方的数据入口。
    // 不直接用浏览器 File API，是因为 vault API 会处理 Obsidian 的缓存、同步和文件适配层。
    const originalMarkdown = await this.plugin.app.vault.read(file);
    const replacedMarkdown = replaceCodeBlockSource(
      originalMarkdown,
      CODE_BLOCK_NAME,
      this.source,
      nextSource,
      sectionInfo
    );

    if (replacedMarkdown === null) {
      new Notice('yonxao-mindmap: 未定位到当前 yxmm 代码块，保存失败。');
      return false;
    }

    await this.plugin.app.vault.modify(file, replacedMarkdown);
    return true;
  }

  /*
   * 作用：
   * 在编辑器上下文中直接替换当前代码块内容。
   */
  saveSourceToEditor(nextSource) {
    const context = this.editorContext;
    if (!context || !context.view) {
      new Notice('yonxao-mindmap: 找不到当前编辑器，无法保存。');
      return false;
    }

    context.view.dispatch({
      changes: {
        from: context.contentFrom,
        to: context.contentTo,
        insert: nextSource,
      },
    });
    context.contentTo = context.contentFrom + nextSource.length;

    return true;
  }

  /*
   * 作用：
   * 根据 Markdown 渲染上下文找到当前代码块所在文件。
   */
  getMarkdownFile() {
    // ctx.sourcePath 是当前代码块所在的 Markdown 文件路径，相对于 vault 根目录。
    // getAbstractFileByPath 可能返回文件，也可能返回文件夹；这里用 children 字段排除文件夹。
    const sourcePath = this.ctx && this.ctx.sourcePath;
    if (!sourcePath || !this.plugin || !this.plugin.app) return null;

    const file = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
    if (!file || file.children) return null;
    return file;
  }

  /*
   * 作用：
   * 渲染普通提示或错误提示。
   */
  renderMessage(message, isError) {
    this.hostEl.textContent = '';
    const messageEl = document.createElement('div');
    messageEl.className = isError
      ? 'yonxao-mindmap-message yonxao-mindmap-message-error'
      : 'yonxao-mindmap-message';
    messageEl.textContent = message;
    this.hostEl.appendChild(messageEl);
  }

  /*
   * 作用：
   * 重新布局并绘制整张思维导图。
   *
   * 调用链：
   * mount()/保存/折叠/重置 -> renderMap()。
   */
  renderMap(fitAfterRender, options = {}) {
    this.clearTopicDropHighlight();
    this.closeInlineTextEditor(false);
    this.topicById.clear();
    this.mapEl.textContent = '';

    // 渲染分两步：先把树计算成带坐标的主题/连线，再把这些数据画成 SVG。
    // 这样解析、布局、绘制互相独立，后续要替换布局算法也更容易。
    const layout = layoutTree(this.root, this.collapsedIds, this.config);
    const connectorLayer = svg('g', { class: 'yonxao-mindmap-connectors' });
    const topicLayer = svg('g', { class: 'yonxao-mindmap-topics' });

    const treeTrunk = this.renderTreeTrunk(layout);
    if (treeTrunk) {
      connectorLayer.appendChild(treeTrunk);
    }
    const orgSharedTrunks = this.renderOrgSharedTrunks(layout);
    if (orgSharedTrunks) {
      connectorLayer.appendChild(orgSharedTrunks);
    }
    const orgRightTrunk = this.renderOrgRightTrunk(layout);
    if (orgRightTrunk) {
      connectorLayer.appendChild(orgRightTrunk);
    }
    const orgRightBranchTrunks = this.renderOrgRightBranchTrunks(layout);
    if (orgRightBranchTrunks) {
      connectorLayer.appendChild(orgRightBranchTrunks);
    }
    const timelineAxis = this.renderTimelineAxis(layout);
    if (timelineAxis) {
      connectorLayer.appendChild(timelineAxis);
    }
    const fishboneMainSpine = this.renderFishboneMainSpine(layout);
    if (fishboneMainSpine) {
      connectorLayer.appendChild(fishboneMainSpine);
    }
    const timelineDetailTrunks = this.renderTimelineDetailTrunks(layout);
    if (timelineDetailTrunks) {
      connectorLayer.appendChild(timelineDetailTrunks);
    }
    const mindMapRootElbowConnectors = this.renderMindMapRootElbowConnectors(layout);
    if (mindMapRootElbowConnectors) {
      connectorLayer.appendChild(mindMapRootElbowConnectors);
    }

    if (!this.isTreeTableLayoutMode(layout.mode)) {
      for (const connector of layout.connectors) {
        if (this.isMindMapRootElbowConnector(connector, layout.mode)) continue;
        if (this.isOrgSharedTrunkConnector(connector, layout.mode)) continue;

        const connectorEl = this.renderConnector(connector, layout.mode);
        if (connectorEl) {
          connectorLayer.appendChild(connectorEl);
        }
      }
    }

    for (const topic of layout.topics) {
      this.topicById.set(topic.id, topic);
      topicLayer.appendChild(this.renderTopic(topic));
    }

    this.mapEl.appendChild(connectorLayer);
    this.mapEl.appendChild(topicLayer);

    if (fitAfterRender || !this.viewBox) {
      this.applyConfiguredViewFit(layout.bounds, options);
    }

    this.didInitialMapRender = true;
  }

  /*
   * 作用：
   * 在树形图中绘制 root 下方的纵向主干。
   *
   * 实现逻辑：
   * root -> 一级主题的每条边只负责横向分支；主干单独画一次。
   * 这样可以避免多条 root 边重复覆盖同一段竖线，导致主干颜色越来越深。
   */
  renderTreeTrunk(layout) {
    if (!this.isTreeLayoutMode(layout.mode)) return null;

    const rootBox = this.root?._layout;
    if (!rootBox) return null;

    const rootSubtopicConnectors = layout.connectors.filter((connector) => {
      const side = connector.subtopic?._layout?.side;
      return connector.parentTopic === this.root && (side === 'tree-left' || side === 'tree-right');
    });
    if (!rootSubtopicConnectors.length) return null;

    const startY = rootBox.y + rootBox.height / 2;
    const groupEl = svg('g', { class: 'yonxao-mindmap-tree-trunk' });

    /*
     * 树形图的纵向主干和思维导图折线主干一样，都是多个一级主题共享的线段。
     * 如果画成一整条单色线，就会丢失分支颜色；如果每条 root 边都重复画一遍，
     * 后绘制的分支又会覆盖前面的颜色。因此这里按一级主题位置分段绘制。
     */
    this.renderBranchColoredTrunkFromOrigin(
      groupEl,
      rootSubtopicConnectors,
      {
        axis: 'y',
        fixedCoord: rootBox.x,
        originCoord: startY,
      },
      `opacity: ${themeConnectorOpacity(this.config)}`
    );

    return groupEl;
  }

  /*
   * 作用：
   * 判断当前布局是否属于“树形图”系列。
   */
  isTreeLayoutMode(mode) {
    return mode === 'tree-right' || mode === 'tree-left' || mode === 'tree';
  }

  /*
   * 作用：
   * 判断当前布局是否属于树形表格系列。
   *
   * 说明：
   * tree-table 是规整表格，叶子主题会填满剩余列；
   * tree-table-stepped 是阶梯表格，保留层级展开形成的阶梯轮廓。
   */
  isTreeTableLayoutMode(mode) {
    return mode === 'tree-table' || mode === 'tree-table-stepped';
  }

  /*
   * 作用：
   * 绘制标准组织结构图中的共享主干。
   *
   * 适用范围：
   * - org：父主题向下连接一组子主题时，中间会形成一条横向总线。
   * - org-right：root 到一级分支同样使用组织结构图式总线，只是后代继续向右展开。
   *
   * 绘制策略：
   * 普通 org 连线会让每个子主题都重复绘制“父主题下探线 + 横向总线”，颜色会互相覆盖。
   * 这里把共享部分单独拆出来：父主题到总线只画一次，总线按子主题位置分段着色，
   * 子主题下探短线再分别使用各自子主题颜色。
   */
  renderOrgSharedTrunks(layout) {
    if (layout.mode !== 'org' && layout.mode !== 'org-right') return null;

    const groupedConnectors = new Map();
    for (const connector of layout.connectors) {
      if (!this.isOrgSharedTrunkConnector(connector, layout.mode)) continue;
      if (!groupedConnectors.has(connector.parentTopic.id)) {
        groupedConnectors.set(connector.parentTopic.id, []);
      }
      groupedConnectors.get(connector.parentTopic.id).push(connector);
    }

    if (!groupedConnectors.size) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-org-shared-trunks' });
    for (const connectors of groupedConnectors.values()) {
      const trunkGroupEl = this.renderOrgSharedTrunkGroup(connectors);
      if (trunkGroupEl) groupEl.appendChild(trunkGroupEl);
    }

    return groupEl;
  }

  /*
   * 作用：
   * 判断一条组织结构图连线是否应该由共享主干逻辑接管。
   */
  isOrgSharedTrunkConnector(connector, layoutMode) {
    const side = connector.subtopic?._layout?.side;
    if (layoutMode === 'org') return side === 'org-bottom';
    if (layoutMode === 'org-right') return side === 'org-right-branch';
    return false;
  }

  /*
   * 作用：
   * 绘制某个父主题下面的一组组织结构图共享主干。
   */
  renderOrgSharedTrunkGroup(connectors) {
    if (!connectors.length) return null;

    const firstAnchors = this.connectorAnchors(
      connectors[0].parentTopic._layout,
      connectors[0].subtopic._layout
    );
    const busY = firstAnchors.startY + (firstAnchors.endY - firstAnchors.startY) / 2;
    const nearestConnector = this.closestConnectorToRootAxis(connectors, 'x', firstAnchors.startX);
    const nearestColor = connectorColor(nearestConnector.subtopic, this.config) || 'currentColor';
    const opacityStyle = `opacity: ${themeConnectorOpacity(this.config)}`;
    const groupEl = svg('g', { class: 'yonxao-mindmap-org-shared-trunk' });

    /*
     * 父主题到横向总线的短竖线没有明确属于哪一个子主题，
     * 这里沿用基础思维导图的处理：使用离父主题最近的子主题颜色。
     */
    groupEl.appendChild(
      this.renderConnectorPath(
        ['M', firstAnchors.startX, firstAnchors.startY, 'V', busY],
        nearestColor,
        opacityStyle
      )
    );
    this.renderBranchColoredTrunkFromOrigin(
      groupEl,
      connectors,
      {
        axis: 'x',
        fixedCoord: busY,
        originCoord: firstAnchors.startX,
      },
      opacityStyle
    );

    for (const connector of connectors) {
      const anchors = this.connectorAnchors(
        connector.parentTopic._layout,
        connector.subtopic._layout
      );
      const branchColor = connectorColor(connector.subtopic, this.config) || 'currentColor';
      groupEl.appendChild(
        this.renderConnectorPath(
          ['M', anchors.endX, busY, 'V', anchors.endY],
          branchColor,
          opacityStyle
        )
      );
    }

    return groupEl;
  }

  /*
   * 作用：
   * 绘制“右向”组织结构图的纵向主干。
   *
   * 当前 org-right 的一级分支使用 org-right-branch，
   * 这里只处理极少数直接落到 org-right side 的根连线兜底情况。
   */
  renderOrgRightTrunk(layout) {
    if (layout.mode !== 'org-right') return null;

    const rootBox = this.root?._layout;
    if (!rootBox) return null;

    const rootSubtopicConnectors = layout.connectors.filter(
      (connector) =>
        connector.parentTopic === this.root && connector.subtopic?._layout?.side === 'org-right'
    );
    if (!rootSubtopicConnectors.length) return null;

    const startY = rootBox.y + rootBox.height / 2;
    const groupEl = svg('g', { class: 'yonxao-mindmap-org-trunk' });

    this.renderBranchColoredTrunkFromOrigin(
      groupEl,
      rootSubtopicConnectors,
      {
        axis: 'y',
        fixedCoord: rootBox.x,
        originCoord: startY,
      },
      `opacity: ${themeConnectorOpacity(this.config)}`
    );

    return groupEl;
  }

  /*
   * 作用：
   * 在 org-right 的二级及更深层级里绘制共享的目录树式分支线。
   *
   * 实现逻辑：
   * 普通 elbow 连线会让每个子主题都从父主题右侧单独折出去，线条显得杂乱。
   * 这里按父主题分组：父主题底部先向下形成一条竖向主线，再由主线横向接到每个子主题。
   */
  renderOrgRightBranchTrunks(layout) {
    if (layout.mode !== 'org-right') return null;

    const groups = new Map();
    for (const connector of layout.connectors) {
      if (connector.subtopic?._layout?.side !== 'org-right') continue;
      if (connector.subtopic?._layout?.branchExpansion === 'side') continue;
      if (connector.parentTopic === this.root) continue;
      if (!groups.has(connector.parentTopic.id)) {
        groups.set(connector.parentTopic.id, []);
      }
      groups.get(connector.parentTopic.id).push(connector);
    }

    if (!groups.size) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-org-right-trunks' });

    for (const connectors of groups.values()) {
      const parentTopic = connectors[0]?.parentTopic;
      const parentBox = parentTopic?._layout;
      if (!parentBox || !connectors.length) continue;

      const startX = parentBox.x;
      const startY = parentBox.y + parentBox.height / 2;

      /*
       * org-right 后代的纵向共享线也按子主题分段上色，
       * 保持和基础思维导图 root 主干一致的颜色节奏。
       */
      this.renderBranchColoredTrunkFromOrigin(
        groupEl,
        connectors,
        {
          axis: 'y',
          fixedCoord: startX,
          originCoord: startY,
        },
        `opacity: ${themeConnectorOpacity(this.config)}`
      );
    }

    return groupEl;
  }

  /*
   * 作用：
   * 计算 org-right 后代分支的共享竖线 x 坐标。
   */
  orgRightBranchX(parentBox) {
    return parentBox.x;
  }

  /*
   * 作用：
   * 计算时间轴详情主题继续展开子主题时的右侧分支线位置。
   *
   * 实现逻辑：
   * - 时间点主题本身仍使用中心竖线，保持时间轴主分支的视觉稳定。
   * - 详情主题再展开后代时，分支线放在主题右侧，形成“父主题右侧出口 -> 竖线 -> 子主题”的结构。
   * - 如果父主题很宽导致父子间距不足，则把分支线夹在父主题右边缘和子主题左边缘之间，避免横线反向。
   */
  timelineDetailBranchX(parentBox, subtopicBoxes = []) {
    if (parentBox.side !== 'timeline-detail-top' && parentBox.side !== 'timeline-detail-bottom') {
      return parentBox.x;
    }

    const parentRight = parentBox.x + parentBox.width / 2;
    const preferredX = parentRight + TOPIC_PADDING_X;
    if (!subtopicBoxes.length) return preferredX;

    const firstSubtopicLeft = Math.min(...subtopicBoxes.map((box) => box.x - box.width / 2));
    const available = firstSubtopicLeft - parentRight;
    if (available <= TOPIC_PADDING_X) {
      return parentRight + Math.max(6, available / 2);
    }

    return Math.min(preferredX, firstSubtopicLeft - TOPIC_PADDING_X / 2);
  }

  /*
   * 作用：
   * 根据放射图射线角度计算主题矩形边框上的交点。
   *
   * 实现逻辑：
   * 放射图的分支可能是斜向的，不能只用 left/right/top/bottom 四类锚点。
   * 这里把主题矩形看作中心点加宽高边界，沿 angle 方向找到射线离开矩形的位置。
   */
  radialConnectorPoint(box, angle) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const tx = Math.abs(dx) > 0.0001 ? box.width / 2 / Math.abs(dx) : Infinity;
    const ty = Math.abs(dy) > 0.0001 ? box.height / 2 / Math.abs(dy) : Infinity;
    const distance = Math.min(tx, ty);

    return {
      x: box.x + dx * distance,
      y: box.y + dy * distance,
    };
  }

  /*
   * 作用：
   * 绘制时间轴布局的横向轴线和 root 到轴线的连接线。
   */
  renderTimelineAxis(layout) {
    if (!this.isTimelineLayoutMode(layout.mode)) return null;

    const rootBox = this.root?._layout;
    const axisY = rootBox?.timelineAxisY;
    if (!rootBox || !Number.isFinite(axisY)) return null;

    const eventTopics = layout.topics.filter((topic) => {
      const side = topic._layout?.side;
      return side === 'timeline-point';
    });
    if (!eventTopics.length) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-timeline-axis' });
    const sortedTopics = [...eventTopics].sort((left, right) => left._layout.x - right._layout.x);
    this.renderSequentialBranchColoredTrunk(
      groupEl,
      sortedTopics,
      {
        axis: 'x',
        fixedCoord: axisY,
        startCoord: rootBox.timelineAxisMinX ?? rootBox.x + rootBox.width / 2,
        segmentEndCoord: (topic) => topic._layout.x - topic._layout.width / 2,
        nextStartCoord: (topic) => topic._layout.x + topic._layout.width / 2,
      },
      `opacity: ${themeConnectorOpacity(this.config)}`
    );

    return groupEl;
  }

  /*
   * 作用：
   * 绘制鱼骨图的水平主骨，并按大分支分段着色。
   *
   * 实现逻辑：
   * root -> 大分支的普通连线只负责斜骨线；主骨在这里单独绘制。
   * 每一段从上一个挂点延伸到当前挂点，颜色使用当前大分支颜色，
   * 避免后面的分支反复覆盖前面的主骨颜色。
   */
  renderFishboneMainSpine(layout) {
    if (!this.isFishboneLayoutMode(layout.mode)) return null;

    const rootBox = this.root?._layout;
    if (!rootBox) return null;

    const direction = layout.mode === 'fishbone-right' ? -1 : 1;
    const branchTopics = layout.topics
      .filter((topic) => {
        const side = topic._layout?.side;
        return side === 'fishbone-top' || side === 'fishbone-bottom';
      })
      .sort(
        (left, right) =>
          direction *
          (left._layout.fishboneMainSpineAttachX - right._layout.fishboneMainSpineAttachX)
      );

    if (!branchTopics.length) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-fishbone-main-spine' });
    const spineStart = rootBox.x + direction * (rootBox.width / 2);
    const segmentStart = this.renderSequentialBranchColoredTrunk(
      groupEl,
      branchTopics,
      {
        axis: 'x',
        fixedCoord: rootBox.y,
        startCoord: spineStart,
        segmentEndCoord: (topic) => topic._layout.fishboneMainSpineAttachX,
        nextStartCoord: (topic) => topic._layout.fishboneMainSpineAttachX,
      },
      `opacity: ${themeConnectorOpacity(this.config)}`
    );

    const lastTopic = branchTopics[branchTopics.length - 1];
    const tailBoundary = this.visibleSubtreeHorizontalBoundary(lastTopic, direction);
    const tailEnd =
      direction > 0
        ? Math.max(segmentStart + LEVEL_GAP * 1.7, tailBoundary)
        : Math.min(segmentStart - LEVEL_GAP * 1.7, tailBoundary);
    const tailEl = this.renderBranchColoredTrunkSegment(
      'x',
      rootBox.y,
      segmentStart,
      tailEnd,
      connectorColor(this.root, this.config) || 'currentColor',
      `opacity: ${themeConnectorOpacity(this.config)}`
    );
    if (tailEl) {
      groupEl.appendChild(tailEl);
    }
    groupEl.appendChild(this.renderFishboneTail(tailEnd, rootBox.y, direction));

    return groupEl;
  }

  /*
   * 作用：
   * 绘制鱼骨图尾端的鱼尾形状。
   */
  renderFishboneTail(x, y, direction = 1) {
    const color = connectorColor(this.root, this.config);
    const wingX = 18;
    const wingY = 10;
    const wingEndX = x + direction * wingX;

    return svg('path', {
      class: 'yonxao-mindmap-connector yonxao-mindmap-fishbone-tail',
      d: ['M', x, y, 'L', wingEndX, y - wingY, 'M', x, y, 'L', wingEndX, y + wingY].join(' '),
      stroke: color || 'currentColor',
      style: `opacity: ${themeConnectorOpacity(this.config)}`,
    });
  }

  /*
   * 作用：
   * 计算当前可见子树在鱼尾方向上的水平边界。
   *
   * 调用场景：
   * 鱼骨图尾巴需要根据最后一个分支的可见内容自动延长。
   * 折叠主题的后代不会显示，所以这里遇到 collapsedIds 时停止递归。
   */
  visibleSubtreeHorizontalBoundary(topic, direction = 1) {
    const box = topic?._layout;
    if (!box) return direction > 0 ? -Infinity : Infinity;

    let boundary = direction > 0 ? box.x + box.width / 2 : box.x - box.width / 2;
    if (this.collapsedIds.has(topic.id)) return boundary;

    for (const subtopic of topic.subtopics || []) {
      const subtopicBoundary = this.visibleSubtreeHorizontalBoundary(subtopic, direction);
      boundary =
        direction > 0 ? Math.max(boundary, subtopicBoundary) : Math.min(boundary, subtopicBoundary);
    }

    return boundary;
  }

  /*
   * 作用：
   * 绘制时间轴详情区的目录树式竖向主线。
   */
  renderTimelineDetailTrunks(layout) {
    if (!this.isTimelineLayoutMode(layout.mode)) return null;

    const groups = new Map();
    for (const connector of layout.connectors) {
      const side = connector.subtopic?._layout?.side;
      if (side !== 'timeline-detail-top' && side !== 'timeline-detail-bottom') continue;
      if (connector.subtopic?._layout?.branchExpansion === 'side') continue;
      if (connector.subtopic?._layout?.branchExpansion === 'hanging') continue;
      if (!groups.has(connector.parentTopic.id)) {
        groups.set(connector.parentTopic.id, []);
      }
      groups.get(connector.parentTopic.id).push(connector);
    }

    if (!groups.size) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-timeline-detail-trunks' });
    for (const connectors of groups.values()) {
      const parentTopic = connectors[0]?.parentTopic;
      const parentBox = parentTopic?._layout;
      if (!parentBox || !connectors.length) continue;

      const firstSide = connectors[0].subtopic._layout.side;
      const subtopicBoxes = connectors.map((connector) => connector.subtopic._layout);
      const trunkX = this.timelineDetailBranchX(parentBox, subtopicBoxes);
      const isDetailParent =
        parentBox.side === 'timeline-detail-top' || parentBox.side === 'timeline-detail-bottom';
      const startX = isDetailParent ? parentBox.x + parentBox.width / 2 : parentBox.x;
      const subtopicYs = connectors.map((connector) => connector.subtopic._layout.y);
      const minSubtopicY = Math.min(...subtopicYs);
      const maxSubtopicY = Math.max(...subtopicYs);
      const startY = isDetailParent
        ? parentBox.y
        : firstSide === 'timeline-detail-top'
          ? parentBox.y - parentBox.height / 2
          : parentBox.y + parentBox.height / 2;
      const trunkStartY = isDetailParent ? minSubtopicY : startY;
      const trunkEndY = isDetailParent
        ? maxSubtopicY
        : firstSide === 'timeline-detail-top'
          ? minSubtopicY
          : maxSubtopicY;
      const color = connectorColor(parentTopic, this.config);
      const commands = [];

      if (startX !== trunkX) {
        commands.push('M', startX, startY, 'H', trunkX);
      }

      commands.push('M', trunkX, trunkStartY, 'V', trunkEndY);

      groupEl.appendChild(
        svg('path', {
          class: 'yonxao-mindmap-connector yonxao-mindmap-timeline-detail-trunk',
          d: commands.join(' '),
          stroke: color || 'currentColor',
          style: `opacity: ${themeConnectorOpacity(this.config)}`,
        })
      );
    }

    return groupEl;
  }

  /*
   * 作用：
   * 判断当前布局是否属于“时间轴”系列。
   */
  isTimelineLayoutMode(mode) {
    return mode === 'timeline-up' || mode === 'timeline-down' || mode === 'timeline';
  }

  /*
   * 作用：
   * 判断当前布局是否属于“鱼骨图”系列。
   */
  isFishboneLayoutMode(mode) {
    return mode === 'fishbone-left' || mode === 'fishbone-right';
  }

  /*
   * 作用：
   * 根据父子主题布局信息绘制一条连线。
   */
  renderConnector(connector, layoutMode) {
    const parentBox = connector.parentTopic._layout;
    const subtopicBox = connector.subtopic._layout;
    const anchors = this.connectorAnchors(parentBox, subtopicBox);
    if (anchors.kind === 'skip') return null;
    const color = this.renderConnectorColor(connector, anchors);

    // 只有思维导图组允许用户选择线型；树形图等结构图固定按折线绘制，避免默认 curve 泄漏到不可配置布局。
    return svg('path', {
      class: 'yonxao-mindmap-connector',
      d: this.connectorPath(anchors, layoutMode),
      stroke: color || 'currentColor',
      style: `opacity: ${themeConnectorOpacity(this.config)}`,
    });
  }

  /*
   * 作用：
   * 根据特殊结构决定连线颜色。
   */
  renderConnectorColor(connector, anchors) {
    if (anchors.kind === 'timeline-detail') {
      return connectorColor(connector.parentTopic, this.config);
    }

    return connectorColor(connector.subtopic, this.config);
  }

  /*
   * 作用：
   * 单独绘制思维导图组中 root -> 一级主题的折线。
   *
   * 为什么需要单独绘制：
   * 普通 elbow 折线会让每条一级分支都重复绘制 root 到中间折点的共享主干。
   * 多条 SVG path 叠在一起时，后绘制的分支颜色会覆盖先绘制的颜色。
   *
   * 当前策略：
   * - root 到共享主干的短线：使用离 root 最近的一级主题颜色。
   * - 共享主干本身：从 root 附近向两侧分段绘制，每段使用对应一级主题颜色。
   * - 共享主干到每个一级主题的分支短线：使用对应一级主题颜色。
   *
   * 这样视觉上仍然是一条清爽的折线主干，同时每个一级分支颜色保持独立。
   */
  renderMindMapRootElbowConnectors(layout) {
    if (this.effectiveConnectorStyle(layout.mode) !== 'elbow') return null;
    if (!this.isMindMapLayoutMode(layout.mode)) return null;

    const rootConnectors = layout.connectors.filter((connector) =>
      this.isMindMapRootElbowConnector(connector, layout.mode)
    );
    if (!rootConnectors.length) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-root-elbow-connectors' });
    const connectorsBySide = this.groupMindMapRootConnectorsBySide(rootConnectors);

    for (const [side, connectors] of connectorsBySide.entries()) {
      const sideGroupEl = this.renderMindMapRootElbowSide(side, connectors);
      if (sideGroupEl) groupEl.appendChild(sideGroupEl);
    }

    return groupEl;
  }

  /*
   * 作用：
   * 判断一条连线是否应该交给“中心主题共享折线”绘制逻辑处理。
   */
  isMindMapRootElbowConnector(connector, layoutMode) {
    if (this.effectiveConnectorStyle(layoutMode) !== 'elbow') return false;
    if (!this.isMindMapLayoutMode(layoutMode)) return false;
    if (connector.parentTopic !== this.root) return false;

    const side = connector.subtopic?._layout?.side;
    return side === 'right' || side === 'left' || side === 'top' || side === 'bottom';
  }

  /*
   * 作用：
   * 按一级主题所在方向分组，分别处理右、左、上、下四种共享主干。
   */
  groupMindMapRootConnectorsBySide(rootConnectors) {
    const connectorsBySide = new Map();

    for (const connector of rootConnectors) {
      const side = connector.subtopic._layout.side;
      if (!connectorsBySide.has(side)) {
        connectorsBySide.set(side, []);
      }
      connectorsBySide.get(side).push(connector);
    }

    return connectorsBySide;
  }

  /*
   * 作用：
   * 绘制某一个方向上的中心主题共享主干和分支短线。
   */
  renderMindMapRootElbowSide(side, connectors) {
    if (!connectors.length) return null;

    const firstAnchors = this.connectorAnchors(
      connectors[0].parentTopic._layout,
      connectors[0].subtopic._layout
    );
    const groupEl = svg('g', { class: 'yonxao-mindmap-root-elbow-side' });
    const opacityStyle = `opacity: ${themeConnectorOpacity(this.config)}`;

    if (side === 'right' || side === 'left') {
      const bendX = firstAnchors.startX + (firstAnchors.endX - firstAnchors.startX) / 2;
      const nearestConnector = this.closestConnectorToRootAxis(
        connectors,
        'y',
        firstAnchors.startY
      );
      const nearestColor = connectorColor(nearestConnector.subtopic, this.config) || 'currentColor';

      /*
       * root 到共享主干只画一次，颜色取离 root 最近的一级主题。
       * 共享竖线再按一级主题位置切成短段，避免最后一个主题覆盖整根主干。
       */
      groupEl.appendChild(
        this.renderConnectorPath(
          ['M', firstAnchors.startX, firstAnchors.startY, 'H', bendX],
          nearestColor,
          opacityStyle
        )
      );
      this.renderBranchColoredTrunkFromOrigin(
        groupEl,
        connectors,
        {
          axis: 'y',
          fixedCoord: bendX,
          originCoord: firstAnchors.startY,
        },
        opacityStyle
      );

      for (const connector of connectors) {
        const anchors = this.connectorAnchors(
          connector.parentTopic._layout,
          connector.subtopic._layout
        );
        const branchColor = connectorColor(connector.subtopic, this.config) || 'currentColor';
        groupEl.appendChild(
          this.renderConnectorPath(
            ['M', bendX, anchors.endY, 'H', anchors.endX],
            branchColor,
            opacityStyle
          )
        );
      }

      return groupEl;
    }

    const bendY = firstAnchors.startY + (firstAnchors.endY - firstAnchors.startY) / 2;
    const nearestConnector = this.closestConnectorToRootAxis(connectors, 'x', firstAnchors.startX);
    const nearestColor = connectorColor(nearestConnector.subtopic, this.config) || 'currentColor';

    groupEl.appendChild(
      this.renderConnectorPath(
        ['M', firstAnchors.startX, firstAnchors.startY, 'V', bendY],
        nearestColor,
        opacityStyle
      )
    );
    this.renderBranchColoredTrunkFromOrigin(
      groupEl,
      connectors,
      {
        axis: 'x',
        fixedCoord: bendY,
        originCoord: firstAnchors.startX,
      },
      opacityStyle
    );

    for (const connector of connectors) {
      const anchors = this.connectorAnchors(
        connector.parentTopic._layout,
        connector.subtopic._layout
      );
      const branchColor = connectorColor(connector.subtopic, this.config) || 'currentColor';
      groupEl.appendChild(
        this.renderConnectorPath(
          ['M', anchors.endX, bendY, 'V', anchors.endY],
          branchColor,
          opacityStyle
        )
      );
    }

    return groupEl;
  }

  /*
   * 作用：
   * 在 root 共享主干中找到离 root 出口最近的一级主题。
   *
   * 使用场景：
   * root 到共享主干的短线没有明确属于哪一个分支，因此取离 root 最近的分支色，
   * 让这段短线仍然保持“跟随分支色”的语义，而不是退回中心主题色。
   */
  closestConnectorToRootAxis(connectors, axis, originCoord) {
    return connectors.reduce((closest, connector) => {
      const currentDistance = Math.abs(connector.subtopic._layout[axis] - originCoord);
      const closestDistance = Math.abs(closest.subtopic._layout[axis] - originCoord);
      return currentDistance < closestDistance ? connector : closest;
    }, connectors[0]);
  }

  /*
   * 作用：
   * 按一级主题位置，把共享主干拆成多个着色短段。
   *
   * 实现逻辑：
   * 以中心主题出口为原点，分别向上/下或左/右扩展：
   * - 离中心主题最近的一段使用最近一级主题颜色；
   * - 下一段使用下一个一级主题颜色；
   * - 依次类推。
   *
   * 这样得到的效果和鱼骨图、时间轴类似：主干不是被最后一个主题覆盖，而是按分支自然分段。
   */
  renderBranchColoredTrunkFromOrigin(groupEl, connectors, trunk, opacityStyle) {
    const negativeSideConnectors = connectors
      .filter((connector) => connector.subtopic._layout[trunk.axis] < trunk.originCoord)
      .sort(
        (left, right) => right.subtopic._layout[trunk.axis] - left.subtopic._layout[trunk.axis]
      );
    const positiveSideConnectors = connectors
      .filter((connector) => connector.subtopic._layout[trunk.axis] > trunk.originCoord)
      .sort(
        (left, right) => left.subtopic._layout[trunk.axis] - right.subtopic._layout[trunk.axis]
      );

    this.renderBranchColoredTrunkRun(groupEl, negativeSideConnectors, trunk, opacityStyle);
    this.renderBranchColoredTrunkRun(groupEl, positiveSideConnectors, trunk, opacityStyle);
  }

  /*
   * 作用：
   * 从共享主干原点开始，沿一个方向逐段绘制主干。
   */
  renderBranchColoredTrunkRun(groupEl, sortedConnectors, trunk, opacityStyle) {
    let segmentStartCoord = trunk.originCoord;

    for (const connector of sortedConnectors) {
      const segmentEndCoord = connector.subtopic._layout[trunk.axis];
      const segmentColor = connectorColor(connector.subtopic, this.config) || 'currentColor';
      const segmentEl = this.renderBranchColoredTrunkSegment(
        trunk.axis,
        trunk.fixedCoord,
        segmentStartCoord,
        segmentEndCoord,
        segmentColor,
        opacityStyle
      );

      if (segmentEl) groupEl.appendChild(segmentEl);
      segmentStartCoord = segmentEndCoord;
    }
  }

  /*
   * 作用：
   * 按主题顺序逐段绘制共享主干。
   *
   * 适用场景：
   * 时间轴和鱼骨图这类结构不是以 root 出口为中心向两侧扩展，
   * 而是从左到右逐段推进。它们仍然遵循同一条原则：每段主干使用当前主题颜色，
   * 避免后绘制的主题覆盖前面主题的主干颜色。
   *
   * 返回值：
   * 返回最后一段之后的起点，方便鱼骨图继续绘制尾巴。
   */
  renderSequentialBranchColoredTrunk(groupEl, topics, trunk, opacityStyle) {
    let segmentStartCoord = trunk.startCoord;

    for (const topic of topics) {
      const segmentEndCoord = trunk.segmentEndCoord(topic);
      const segmentColor = connectorColor(topic, this.config) || 'currentColor';
      const segmentEl = this.renderBranchColoredTrunkSegment(
        trunk.axis,
        trunk.fixedCoord,
        segmentStartCoord,
        segmentEndCoord,
        segmentColor,
        opacityStyle
      );

      if (segmentEl) groupEl.appendChild(segmentEl);
      segmentStartCoord = trunk.nextStartCoord(topic);
    }

    return segmentStartCoord;
  }

  /*
   * 作用：
   * 绘制共享主干中的一个短段。
   */
  renderBranchColoredTrunkSegment(axis, fixedCoord, startCoord, endCoord, stroke, opacityStyle) {
    if (
      !Number.isFinite(fixedCoord) ||
      !Number.isFinite(startCoord) ||
      !Number.isFinite(endCoord)
    ) {
      return null;
    }
    if (Math.abs(endCoord - startCoord) < 0.001) return null;

    const pathParts =
      axis === 'y'
        ? ['M', fixedCoord, startCoord, 'V', endCoord]
        : ['M', startCoord, fixedCoord, 'H', endCoord];

    return this.renderConnectorPath(pathParts, stroke, opacityStyle);
  }

  /*
   * 作用：
   * 创建统一样式的连线路径，减少共享主干拆段绘制时的重复代码。
   */
  renderConnectorPath(pathParts, stroke, opacityStyle) {
    return svg('path', {
      class: 'yonxao-mindmap-connector',
      d: pathParts.join(' '),
      stroke,
      style: opacityStyle,
    });
  }

  /*
   * 作用：
   * 判断布局是否属于“思维导图”分组。
   */
  isMindMapLayoutMode(mode) {
    return (
      mode === 'mindmap-right' ||
      mode === 'mindmap-left' ||
      mode === 'mindmap-bidirectional' ||
      mode === 'mindmap-up' ||
      mode === 'mindmap-down' ||
      mode === 'mindmap-vertical'
    );
  }

  /*
   * 作用：
   * 根据布局语义决定实际用于绘制的线型。
   *
   * 关键点：
   * connector.style 的运行时默认值是 curve，但它只对思维导图组生效。
   * 树形图、组织结构图、时间轴、鱼骨图等布局在配置 UI 中不可设置线型，
   * 因此渲染层也必须固定为 elbow，保证“不可配置”和“实际效果”一致。
   */
  effectiveConnectorStyle(layoutMode) {
    return this.isMindMapLayoutMode(layoutMode) ? this.config.connector.style : 'elbow';
  }

  /*
   * 作用：
   * 根据子主题所在方向计算父子连线的起点和终点锚点。
   */
  connectorAnchors(parentBox, subtopicBox) {
    const side = subtopicBox.side;

    if (subtopicBox.branchExpansion === 'hanging') {
      if (side === 'top' || side === 'bottom') {
        const direction = side === 'top' ? -1 : 1;
        return {
          kind: 'hanging-vertical',
          startX: parentBox.x + parentBox.width / 2,
          startY: parentBox.y,
          endX: subtopicBox.x,
          endY: subtopicBox.y - direction * (subtopicBox.height / 2),
        };
      }

      const direction =
        side === 'left' || side === 'tree-left' || subtopicBox.fishboneDirection < 0 ? -1 : 1;
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
        startX: subtopicBox.fishboneMainSpineAttachX,
        startY: parentBox.y,
        endX: subtopicBox.x,
        endY:
          side === 'fishbone-top'
            ? subtopicBox.y + subtopicBox.height / 2
            : subtopicBox.y - subtopicBox.height / 2,
      };
    }

    if (Number.isFinite(subtopicBox.radialAngle)) {
      const start = this.radialConnectorPoint(parentBox, subtopicBox.radialAngle);
      const end = this.radialConnectorPoint(subtopicBox, subtopicBox.radialAngle + Math.PI);
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
        startX: subtopicBox.fishboneDiagonalBoneAttachX,
        startY: subtopicBox.fishboneDiagonalBoneAttachY,
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

      const startX = this.timelineDetailBranchX(parentBox, [subtopicBox]);
      return {
        kind: 'timeline-detail',
        startX,
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
        startX: this.orgRightBranchX(parentBox),
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

  /*
   * 作用：
   * 根据配置生成连线路径。
   *
   * 线型说明：
   * - curve: 三次贝塞尔曲线，也就是当前默认的柔和曲线。
   * - straight: 直线。
   * - elbow: 正交折线，也常叫 elbow connector。
   */
  connectorPath(anchors, layoutMode) {
    const { kind, startX, startY, endX, endY, axis, sign } = anchors;
    const connectorStyle = this.effectiveConnectorStyle(layoutMode);

    if (kind === 'tree-branch' || kind === 'trunk-branch') {
      return ['M', startX, startY, 'H', endX].join(' ');
    }

    if (kind === 'org') {
      const midY = startY + (endY - startY) / 2;
      return ['M', startX, startY, 'V', midY, 'H', endX, 'V', endY].join(' ');
    }

    if (kind === 'org-right-subtopic') {
      return ['M', startX, startY, 'H', endX].join(' ');
    }

    if (kind === 'timeline-detail') {
      return ['M', startX, startY, 'H', endX].join(' ');
    }

    if (kind === 'hanging-horizontal') {
      return ['M', startX, startY, 'V', endY, 'H', endX].join(' ');
    }

    if (kind === 'hanging-vertical') {
      return ['M', startX, startY, 'H', endX, 'V', endY].join(' ');
    }

    if (kind === 'radial') {
      return ['M', startX, startY, 'L', endX, endY].join(' ');
    }

    if (kind === 'fishbone-primary-bone') {
      return ['M', startX, startY, 'L', endX, endY].join(' ');
    }

    if (kind === 'fishbone-rib-descendant') {
      const midX = startX + (endX - startX) / 2;
      return ['M', startX, startY, 'H', midX, 'V', endY, 'H', endX].join(' ');
    }

    if (kind === 'fishbone-rib-topic') {
      return ['M', startX, startY, 'H', endX].join(' ');
    }

    if (kind === 'skip') {
      return '';
    }

    if (connectorStyle === 'straight') {
      return ['M', startX, startY, 'L', endX, endY].join(' ');
    }

    if (connectorStyle === 'elbow') {
      if (axis === 'y') {
        const midY = startY + (endY - startY) / 2;
        return ['M', startX, startY, 'V', midY, 'H', endX, 'V', endY].join(' ');
      }

      const midX = startX + (endX - startX) / 2;
      return ['M', startX, startY, 'H', midX, 'V', endY, 'H', endX].join(' ');
    }

    const bend = Math.max(44, Math.abs(axis === 'y' ? endY - startY : endX - startX) * 0.46);
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

  /*
   * 作用：
   * 绘制单个思维导图主题，包括卡片、图标、文字、编辑按钮和折叠按钮。
   */
  renderTopic(topic) {
    const box = topic._layout;
    const canEdit = this.canEditMindMap();
    const classNames = ['yonxao-mindmap-topic'];
    if (topic.subtopics.length) classNames.push('yonxao-mindmap-topic-clickable');
    if (canEdit && !topic._virtual && topic !== this.root) {
      classNames.push('yonxao-mindmap-topic-draggable');
    }
    if (this.isTreeTableBox(box)) {
      classNames.push('yonxao-mindmap-topic-tree-table');
    }
    if (this.isTreeTableRootBox(box)) {
      classNames.push('yonxao-mindmap-topic-tree-table-root');
    }

    // 每个主题都是一个 <g> 分组，组上保存 data-topic-id，点击时用它反查原始树主题。
    const group = svg('g', {
      class: classNames.join(' '),
      transform: `translate(${box.x - box.width / 2} ${box.y - box.height / 2})`,
      'data-topic-id': topic.id,
    });

    const color = topicColor(topic, this.config);
    const fill = color
      ? transparentColor(color, themeTopicFillAlpha(this.config))
      : 'var(--background-primary)';
    const stroke = color || 'var(--background-modifier-border)';

    group.appendChild(
      svg('rect', {
        class: 'yonxao-mindmap-topic-card',
        width: box.width,
        height: box.height,
        rx: this.isTreeTableBox(box) ? 0 : 8,
        fill,
        stroke,
      })
    );

    if (box.icon) {
      group.appendChild(
        renderIcon(box.icon, TOPIC_PADDING_X, (box.height - box.iconSize) / 2, color, box.iconSize)
      );
    }

    const textEl = svg('text', {
      class: 'yonxao-mindmap-topic-text',
      x: box.textX,
      y: box.textY,
      'text-anchor': 'start',
      'font-family': box.font.family,
      'font-size': box.font.size,
      'font-weight': box.font.weight,
    });

    for (let index = 0; index < box.lines.length; index += 1) {
      const tspan = svg('tspan', {
        x: box.textX,
        dy: index === 0 ? 0 : box.font.lineHeight,
      });
      tspan.textContent = box.lines[index];
      textEl.appendChild(tspan);
    }

    group.appendChild(textEl);

    if (canEdit && !topic._virtual && !this.shouldHideEditControl(topic)) {
      group.appendChild(this.renderEditButton(topic, box));
    }

    if (canEdit && !topic._virtual && topic !== this.root && !this.shouldHideAddControls(topic)) {
      group.appendChild(this.renderSiblingButtons(box));
    }

    if (
      canEdit &&
      !topic._virtual &&
      !topic.subtopics.length &&
      !this.shouldHideAddControls(topic)
    ) {
      group.appendChild(this.renderSubtopicButton(box));
    }

    if (topic.subtopics.length) {
      group.appendChild(this.renderTopicToggle(topic));
    }

    return group;
  }

  /*
   * 作用：
   * 绘制主题右侧或左侧的折叠/展开按钮。
   */
  renderTopicToggle(topic) {
    const box = topic._layout;
    const collapsed = this.collapsedIds.has(topic.id);
    const outlet = this.topicTogglePoint(box);
    const dir = box.side === 'left' ? -1 : 1;
    const toggle = svg('g', {
      class: 'yonxao-mindmap-toggle',
      transform: `translate(${outlet.x} ${outlet.y})`,
    });

    toggle.appendChild(
      svg('circle', {
        cx: 0,
        cy: 0,
        r: 8,
      })
    );
    toggle.appendChild(
      svg('path', {
        d: `M ${-3 * dir} 0 H ${3 * dir}`,
      })
    );

    if (collapsed) {
      toggle.appendChild(
        svg('path', {
          d: 'M 0 -3 V 3',
        })
      );
    }

    return toggle;
  }

  /*
   * 作用：
   * 判断某个主题是否应该隐藏“新增兄弟/新增子主题”控件。
   *
   * 鱼骨图的大分支（Markdown 里的 ##，布局 side 为 fishbone-top/bottom）
   * 是主骨上的一级结构。它们的子主题不是从主题右侧自然长出，而是挂在斜骨线上；
   * 如果继续显示新增按钮，按钮会和鱼骨结构的交点互相干扰，所以这里统一隐藏。
   */
  shouldHideAddControls(topic) {
    const box = topic?._layout;
    return (
      this.isFishbonePrimaryBoneBox(box) || this.isTreeTableBox(box) || this.isTimelinePointBox(box)
    );
  }

  /*
   * 作用：
   * 判断主题是否属于树形表格布局。
   *
   * 树形表格的单元格空间更紧凑，悬浮新增按钮容易遮挡文本和边框；
   * 因此主题新增动作优先通过右键菜单完成。
   */
  isTreeTableBox(box) {
    const side = String(box?.side || '');
    return side === 'tree-table-root' || side === 'tree-table-cell';
  }

  /*
   * 作用：
   * 判断主题是否是树形表格的表头主题。
   */
  isTreeTableRootBox(box) {
    return String(box?.side || '') === 'tree-table-root';
  }

  /*
   * 作用：
   * 判断某个主题是否应该隐藏“编辑主题”控件。
   *
   * 树形表格当前采用单元格密集排布，右上角编辑按钮会破坏表格视觉，
   * 所以这个布局先隐藏编辑按钮；折叠按钮仍然保留，用于控制子树显示。
   */
  shouldHideEditControl(topic) {
    return this.isTreeTableBox(topic?._layout);
  }

  /*
   * 作用：
   * 判断主题是否是鱼骨图的大分支。
   *
   * 命名说明：
   * Markdown 源码里这些主题是二级标题（##），但在鱼骨图视觉结构里，
   * 它们是从主骨斜着伸出去的“大分支”，所以这里命名为 primaryBone。
   */
  isFishbonePrimaryBoneBox(box) {
    const side = String(box?.side || '');
    return side === 'fishbone-top' || side === 'fishbone-bottom';
  }

  /*
   * 作用：
   * 判断主题是否是时间轴上的二级时间点主题。
   */
  isTimelinePointBox(box) {
    return String(box?.side || '') === 'timeline-point';
  }

  /*
   * 作用：
   * 判断主题是否属于鱼骨图布局。
   *
   * 使用场景：
   * 按钮位置、子线出口等交互逻辑需要先判断“这是不是鱼骨图主题”，
   * 再根据鱼头方向统一计算，而不是把每一种 fishbone side 都写死在调用处。
   */
  isFishboneTopicBox(box) {
    const side = String(box?.side || '');
    return (
      side === 'fishbone-top' ||
      side === 'fishbone-bottom' ||
      side === 'fishbone-rib-topic' ||
      side === 'fishbone-rib-descendant'
    );
  }

  /*
   * 作用：
   * 返回当前鱼骨图的鱼头所在侧。
   *
   * 实现逻辑：
   * fishbone-left 表示鱼头在左、鱼尾向右；fishbone-right 表示鱼头在右、鱼尾向左。
   * 按钮、出口和折叠点等交互逻辑统一从这里读取方向，避免各处写死 left/right。
   */
  fishboneHeadSide() {
    return this.config.layout === 'fishbone-right' ? 'right' : 'left';
  }

  /*
   * 作用：
   * 返回鱼骨图子主题展开方向，也就是从鱼头指向鱼尾的方向。
   *
   * 返回值：
   * 1 表示从左向右展开；-1 表示从右向左展开。
   */
  fishboneGrowthDirection() {
    return this.fishboneHeadSide() === 'left' ? 1 : -1;
  }

  /*
   * 作用：
   * 计算鱼骨图主题的子线出口侧。
   *
   * 设计逻辑：
   * 子线出口永远朝向鱼尾，也就是远离鱼头的一侧。
   * 鱼头在左时出口在右；鱼头在右时出口在左。
   */
  fishboneSubtopicOutletSide() {
    return this.fishboneGrowthDirection() > 0 ? 'right' : 'left';
  }

  /*
   * 作用：
   * 计算鱼骨图主题编辑按钮的位置。
   *
   * 设计逻辑：
   * 编辑按钮永远放在靠近鱼头的一侧；折叠按钮和新增/子线出口留给鱼尾方向。
   * 这样主题右侧或左侧的功能含义稳定：靠鱼头的一侧用于编辑，靠鱼尾的一侧用于展开结构。
   */
  fishboneEditButtonPosition(box, buttonSize) {
    const buttonY = box.height / 2 - buttonSize / 2;
    if (this.fishboneHeadSide() === 'left') {
      return {
        x: -buttonSize / 2,
        y: buttonY,
      };
    }

    return {
      x: box.width - buttonSize / 2,
      y: buttonY,
    };
  }

  /*
   * 作用：
   * 绘制“新增兄弟主题”的两个小按钮。
   *
   * 实现逻辑：
   * 当前思维导图是左右展开布局，同级主题在垂直方向排列，所以按钮放在主题上/下边框。
   * 如果后续加入 top/bottom/vertical 竖向结构，同级主题会更偏横向排列，此函数会把按钮切到左/右边框。
   */
  renderSiblingButtons(box) {
    const group = svg('g', { class: 'yonxao-mindmap-topic-sibling-actions' });
    const horizontal = this.shouldPlaceSiblingButtonsHorizontally(box);
    const positions = horizontal
      ? [
          {
            placement: 'before',
            label: this.t('topicButton.addSiblingLeft'),
            x: 0,
            y: box.height / 2,
          },
          {
            placement: 'after',
            label: this.t('topicButton.addSiblingRight'),
            x: box.width,
            y: box.height / 2,
          },
        ]
      : [
          {
            placement: 'before',
            label: this.t('topicButton.addSiblingAbove'),
            x: box.width / 2,
            y: 0,
          },
          {
            placement: 'after',
            label: this.t('topicButton.addSiblingBelow'),
            x: box.width / 2,
            y: box.height,
          },
        ];

    for (const position of positions) {
      group.appendChild(this.renderSiblingButton(position));
    }

    return group;
  }

  /*
   * 作用：
   * 判断兄弟主题按钮应该放在左右还是上下。
   *
   * 当前 layoutTree 只会输出 root/left/right，所以默认是上下按钮。
   * 这里保留 top/bottom/vertical 判断，是为了后续真正支持竖向结构时不用再重写按钮渲染。
   */
  shouldPlaceSiblingButtonsHorizontally(box) {
    return [
      'top',
      'bottom',
      'vertical',
      'timeline-point',
      'timeline-top',
      'timeline-bottom',
      'org-bottom',
      'org-right-branch',
    ].includes(String(box.side || '').toLowerCase());
  }

  /*
   * 作用：
   * 绘制单个兄弟主题新增按钮。
   */
  renderSiblingButton(position) {
    const button = svg('g', {
      class: 'yonxao-mindmap-topic-sibling-add',
      transform: `translate(${position.x} ${position.y})`,
      'data-sibling-position': position.placement,
    });

    const title = svg('title');
    title.textContent = position.label;
    button.appendChild(title);
    button.appendChild(svg('circle', { cx: 0, cy: 0, r: 7 }));
    button.appendChild(svg('path', { d: 'M -3 0 H 3 M 0 -3 V 3' }));

    return button;
  }

  /*
   * 作用：
   * 绘制“新增子主题”的小按钮。
   *
   * 位置策略：
   * 没有子主题时才显示这个按钮；如果已有子主题，同一位置会显示折叠/展开圆点。
   * 右侧分支放在右边框中点，左侧分支放在左边框中点，中心主题默认放在右边框中点。
   * 鱼骨图不会在这里单独写死方向，而是交给 topicOutletPoint() 按鱼头侧动态推导。
   */
  renderSubtopicButton(box) {
    const outlet = this.topicOutletPoint(box);
    const button = svg('g', {
      class: 'yonxao-mindmap-topic-subtopic-add',
      transform: `translate(${outlet.x} ${outlet.y})`,
      'data-subtopic-side': outlet.side,
    });

    const title = svg('title');
    title.textContent = this.t('topicButton.addSubtopic');
    button.appendChild(title);
    button.appendChild(svg('circle', { cx: 0, cy: 0, r: 8 }));
    button.appendChild(svg('path', { d: 'M -3.5 0 H 3.5 M 0 -3.5 V 3.5' }));

    return button;
  }

  /*
   * 作用：
   * 计算一个主题的“子线出口”位置。
   */
  topicOutletPoint(box) {
    const side = this.topicOutletSide(box);
    if (side === 'left') return { side, x: 0, y: box.height / 2 };
    if (side === 'top') return { side, x: box.width / 2, y: 0 };
    if (side === 'bottom') return { side, x: box.width / 2, y: box.height };
    return { side: 'right', x: box.width, y: box.height / 2 };
  }

  /*
   * 作用：
   * 计算折叠/展开按钮的位置。
   *
   * 普通布局直接复用子线出口位置；鱼骨图大分支比较特殊：
   * 它的子线不是从右侧出去，而是从主题内侧连到斜骨线。
   * 因此折叠按钮应吸附在斜骨线和主题边框的交点，用户能更直观看到它控制的是整条大分支。
   */
  topicTogglePoint(box) {
    const side = String(box?.side || '');
    if (
      (side === 'fishbone-top' || side === 'fishbone-bottom') &&
      Number.isFinite(box.fishboneDiagonalBoneEndX) &&
      Number.isFinite(box.fishboneDiagonalBoneEndY)
    ) {
      return {
        side: side === 'fishbone-top' ? 'bottom' : 'top',
        x: box.fishboneDiagonalBoneEndX - (box.x - box.width / 2),
        y: box.fishboneDiagonalBoneEndY - (box.y - box.height / 2),
      };
    }

    return this.topicOutletPoint(box);
  }

  /*
   * 作用：
   * 根据当前布局和主题所在方向判断子主题应该从哪一侧长出去。
   */
  topicOutletSide(box) {
    const side = String(box.side || '');
    if (box.childBranchExpansion === 'hanging-horizontal') return 'bottom';
    if (box.childBranchExpansion === 'hanging-vertical') return 'right';
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    if (this.isFishboneTopicBox(box) || side === 'root') {
      const mode = this.config.layout;
      if (this.isFishboneLayoutMode(mode)) return this.fishboneSubtopicOutletSide();
    }
    if (this.isTreeTableBox(box)) return 'right';
    if (side === 'tree-left') return 'left';
    if (side === 'org-bottom') return 'bottom';
    if (side === 'org-right' || side === 'org-right-branch') {
      return 'right';
    }
    if (side === 'timeline-point') {
      return box.timelineBranchSide === 'timeline-top' ? 'top' : 'bottom';
    }
    if (side === 'timeline-top') return 'top';
    if (side === 'timeline-bottom') return 'bottom';
    if (side === 'timeline-detail-top' || side === 'timeline-detail-bottom') return 'right';
    if (side === 'tree-right') return 'right';

    const mode = this.config.layout;
    if (mode === 'mindmap-left') return 'left';
    if (mode === 'mindmap-up') return 'top';
    if (mode === 'mindmap-down' || mode === 'org') return 'bottom';
    if (mode === 'org-right') return 'right';
    return 'right';
  }

  /*
   * 作用：
   * 绘制主题编辑按钮。
   */
  renderEditButton(topic, box) {
    // SVG 里不能直接放 HTML button，所以这里用一个小 <g> 分组模拟“编辑按钮”。
    // 点击事件仍然通过 handleTopicClick 统一处理，避免给每个主题单独注册事件造成额外开销。
    // 普通主题放在“父线进入主题”的一侧；中心主题没有父线，单独避开子线出口。
    const buttonSize = 20;
    const position = this.editButtonPosition(topic, box, buttonSize);
    const edit = svg('g', {
      class: 'yonxao-mindmap-topic-edit',
      transform: `translate(${position.x} ${position.y})`,
    });

    const title = svg('title');
    title.textContent = this.t('topicButton.editTopic');
    edit.appendChild(title);
    edit.appendChild(
      svg('rect', {
        width: 20,
        height: 20,
        rx: 5,
      })
    );
    edit.appendChild(
      svg('path', {
        d: 'M6 14.5 6.7 11.4 13.2 4.9 16.1 7.8 9.6 14.3zM12.4 5.7 15.3 8.6',
      })
    );

    return edit;
  }

  /*
   * 作用：
   * 计算主题编辑按钮位置。
   *
   * 实现逻辑：
   * - 普通主题：放在父线进入主题的一侧。
   * - 鱼骨图：编辑按钮统一放鱼头侧，鱼尾侧留给子线出口、折叠按钮和结构延展。
   * - 中心主题：如果子线只从一侧出去，按钮放到对侧；如果左右都有子线，放在上边框中点，避开子线交点。
   */
  editButtonPosition(topic, box, buttonSize) {
    if (box.side === 'root') {
      return this.rootEditButtonPosition(topic, box, buttonSize);
    }

    if (this.isFishboneTopicBox(box)) {
      return this.fishboneEditButtonPosition(box, buttonSize);
    }

    if (this.isTreeTableBox(box)) {
      return {
        x: box.width - buttonSize / 2,
        y: -buttonSize / 2,
      };
    }

    if (box.side === 'top' || box.side === 'timeline-top') {
      return {
        x: box.width / 2 - buttonSize / 2,
        y: box.height - buttonSize / 2,
      };
    }

    if (
      box.side === 'bottom' ||
      box.side === 'timeline-bottom' ||
      box.side === 'org-bottom' ||
      box.side === 'org-right-branch'
    ) {
      return {
        x: box.width / 2 - buttonSize / 2,
        y: -buttonSize / 2,
      };
    }

    if (
      box.side === 'tree-right' ||
      box.side === 'timeline-point' ||
      box.side === 'timeline-detail-top' ||
      box.side === 'timeline-detail-bottom' ||
      box.side === 'org-right'
    ) {
      return {
        x: -buttonSize / 2,
        y: box.height / 2 - buttonSize / 2,
      };
    }

    if (box.side === 'tree-left') {
      return {
        x: box.width - buttonSize / 2,
        y: box.height / 2 - buttonSize / 2,
      };
    }

    return {
      x: box.side === 'right' ? -buttonSize / 2 : box.width - buttonSize / 2,
      y: box.height / 2 - buttonSize / 2,
    };
  }

  /*
   * 作用：
   * 计算中心主题编辑按钮位置。
   */
  rootEditButtonPosition(topic, box, buttonSize) {
    const mode = this.config.layout;
    if (this.isFishboneLayoutMode(mode)) {
      return this.fishboneEditButtonPosition(box, buttonSize);
    }

    if (
      mode === 'mindmap-down' ||
      mode === 'org' ||
      mode === 'org-right' ||
      mode === 'timeline-up' ||
      mode === 'timeline-down' ||
      mode === 'timeline'
    ) {
      return {
        x: box.width / 2 - buttonSize / 2,
        y: -buttonSize / 2,
      };
    }

    if (mode === 'mindmap-up') {
      return {
        x: box.width / 2 - buttonSize / 2,
        y: box.height - buttonSize / 2,
      };
    }

    const sides = new Set((topic.subtopics || []).map((subtopic) => subtopic._layout?.side));
    const hasLeftSubtopics = sides.has('left') || sides.has('tree-left');
    const hasRightSubtopics = sides.has('right') || sides.has('tree-right');

    if (hasLeftSubtopics && hasRightSubtopics) {
      return {
        x: box.width / 2 - buttonSize / 2,
        y: -buttonSize / 2,
      };
    }

    if (hasRightSubtopics) {
      return {
        x: -buttonSize / 2,
        y: box.height / 2 - buttonSize / 2,
      };
    }

    return {
      x: box.width - buttonSize / 2,
      y: box.height / 2 - buttonSize / 2,
    };
  }

  /*
   * 作用：
   * 处理 SVG 主题单击事件。
   *
   * 当前交互规则：
   * - 单击铅笔按钮：打开完整主题编辑面板。
   * - 单击折叠圆点：折叠/展开子主题。
   * - 单击主题本体：暂时无动作，避免误触和双击编辑冲突。
   */
  handleTopicClick(event) {
    if (this.suppressNextTopicClick) {
      this.suppressNextTopicClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target;
    const topicEl = target && target.closest ? target.closest('.yonxao-mindmap-topic') : null;
    if (!topicEl) return;

    const id = topicEl.getAttribute('data-topic-id');
    const topic = this.topicById.get(id);
    if (!topic) return;

    const canEdit = this.canEditMindMap();

    if (
      canEdit &&
      target &&
      target.closest &&
      target.closest('.yonxao-mindmap-topic-subtopic-add')
    ) {
      event.preventDefault();
      event.stopPropagation();
      Promise.resolve(this.addSubtopicFromContextMenu(topic)).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
      return;
    }

    const siblingButton =
      target && target.closest ? target.closest('.yonxao-mindmap-topic-sibling-add') : null;
    if (canEdit && siblingButton) {
      event.preventDefault();
      event.stopPropagation();
      const position = siblingButton.getAttribute('data-sibling-position') || 'after';
      Promise.resolve(this.addSiblingFromContextMenu(topic, position)).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
      return;
    }

    if (canEdit && target && target.closest && target.closest('.yonxao-mindmap-topic-edit')) {
      event.preventDefault();
      event.stopPropagation();
      this.openTopicEditor(topic);
      return;
    }

    if (target && target.closest && target.closest('.yonxao-mindmap-toggle')) {
      event.preventDefault();
      event.stopPropagation();
      this.toggleTopicCollapse(topic);
    }
  }

  /*
   * 作用：
   * 处理主题双击事件，直接进入主题文字的内联编辑状态。
   */
  handleTopicDoubleClick(event) {
    if (!this.canEditMindMap()) return;

    const target = event.target;
    const topicEl = target && target.closest ? target.closest('.yonxao-mindmap-topic') : null;
    if (!topicEl) return;

    // 铅笔按钮和折叠圆点已经有自己的单击语义，双击它们时不进入快速改名。
    if (
      target &&
      target.closest &&
      (target.closest('.yonxao-mindmap-topic-subtopic-add') ||
        target.closest('.yonxao-mindmap-topic-sibling-add') ||
        target.closest('.yonxao-mindmap-topic-edit') ||
        target.closest('.yonxao-mindmap-toggle'))
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const id = topicEl.getAttribute('data-topic-id');
    const topic = this.topicById.get(id);
    if (topic) {
      this.openInlineTextEditor(topic);
    }
  }

  /*
   * 作用：
   * 处理主题右键菜单。
   *
   * 实现逻辑：
   * 只在右键点到真实主题时弹出菜单；右键空白幕布仍交给 Obsidian 或浏览器默认行为。
   * 菜单使用 Obsidian 原生 Menu，能自动适配不同主题和平台。
   */
  handleTopicContextMenu(event) {
    const target = event.target;
    const topicEl = target && target.closest ? target.closest('.yonxao-mindmap-topic') : null;
    if (!topicEl) {
      event.preventDefault();
      event.stopPropagation();
      this.openMapContextMenu(event);
      return;
    }

    if (!this.canEditMindMap()) return;

    const id = topicEl.getAttribute('data-topic-id');
    const topic = this.topicById.get(id);
    if (!topic || topic._virtual) return;

    event.preventDefault();
    event.stopPropagation();
    this.openTopicContextMenu(event, topic);
  }

  /*
   * 作用：
   * 在导图空白处打开全局操作菜单。
   */
  openMapContextMenu(event) {
    const menu = new Menu();

    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyBody'), 'copy', () =>
      this.copyPlainBody()
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyIndentedBody'), 'list-tree', () =>
      this.copyIndentedBody()
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copySource'), 'file-code', () =>
      this.copyFullSource()
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyConfig'), 'settings', () =>
      this.copyConfigSource()
    );
    menu.addSeparator();

    this.addTopicContextMenuItem(menu, this.t('contextMenu.exportPng'), 'download', () =>
      this.exportMapPng()
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyPng'), 'image', () =>
      this.copyMapPng()
    );
    menu.addSeparator();

    this.addTopicContextMenuItem(menu, this.t('toolbar.fitView'), 'scan', () => this.fitView());
    this.addTopicContextMenuItem(menu, this.t('toolbar.originalSize'), 'maximize', () =>
      this.showOriginalSizeView(null, { preserveCanvasHeight: true })
    );

    menu.showAtMouseEvent(event);
  }

  /*
   * 作用：
   * 根据主题状态创建右键上下文菜单。
   *
   * 菜单分组：
   * - 编辑：快速改名、完整属性、复制文本。
   * - 新增：子主题、上方兄弟、下方兄弟。
   * - 展开折叠：单层切换、递归展开、递归折叠。
   * - 删除：删除当前主题和其子树。
   */
  openTopicContextMenu(event, topic) {
    const menu = new Menu();
    const canHaveSiblingTopic = topic !== this.root;
    const hasSubtopics = topic.subtopics.length > 0;
    const isCollapsed = this.collapsedIds.has(topic.id);

    this.addTopicContextMenuItem(menu, this.t('contextMenu.renameTopic'), 'pencil', () =>
      this.openInlineTextEditor(topic)
    );
    this.addTopicContextMenuItem(
      menu,
      this.t('contextMenu.editTopicAttributes'),
      'sliders-horizontal',
      () => this.openTopicEditor(topic)
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyTopicText'), 'copy', () =>
      this.copyTopicText(topic)
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copySubtreeBody'), 'git-branch', () =>
      this.copyPlainSubtree(topic)
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyIndentedSubtree'), 'list-tree', () =>
      this.copyIndentedSubtree(topic)
    );
    menu.addSeparator();

    this.addTopicContextMenuItem(menu, this.t('contextMenu.addSubtopic'), 'plus', () =>
      this.addSubtopicFromContextMenu(topic)
    );
    if (canHaveSiblingTopic) {
      this.addTopicContextMenuItem(menu, this.t('contextMenu.addSiblingAbove'), 'arrow-up', () =>
        this.addSiblingFromContextMenu(topic, 'before')
      );
      this.addTopicContextMenuItem(menu, this.t('contextMenu.addSiblingBelow'), 'arrow-down', () =>
        this.addSiblingFromContextMenu(topic, 'after')
      );
    }

    if (hasSubtopics) {
      menu.addSeparator();
      this.addTopicContextMenuItem(
        menu,
        isCollapsed
          ? this.t('contextMenu.expandSubtopics')
          : this.t('contextMenu.collapseSubtopics'),
        'list-tree',
        () => this.toggleTopicCollapse(topic)
      );
      this.addTopicContextMenuItem(
        menu,
        this.t('contextMenu.expandAllSubtopics'),
        'chevrons-down',
        () => this.expandTopicDescendants(topic)
      );
      this.addTopicContextMenuItem(
        menu,
        this.t('contextMenu.collapseAllSubtopics'),
        'chevrons-up',
        () => this.collapseTopicDescendants(topic)
      );
    }

    if (canHaveSiblingTopic) {
      menu.addSeparator();
      this.addTopicContextMenuItem(menu, this.t('contextMenu.deleteTopic'), 'trash-2', () =>
        this.deleteTopicFromContextMenu(topic)
      );
    }

    menu.showAtMouseEvent(event);
  }

  /*
   * 作用：
   * 给 Obsidian Menu 添加菜单项，并统一异步错误提示。
   */
  addTopicContextMenuItem(menu, title, icon, onClick) {
    menu.addItem((item) => {
      item.setTitle(title);
      if (icon) item.setIcon(icon);
      item.onClick(() => {
        Promise.resolve(onClick()).catch((error) => {
          new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
        });
      });
    });
  }

  /*
   * 作用：
   * 复制主题文本到系统剪贴板。
   */
  async copyTopicText(topic) {
    if (!topic) return false;

    await navigator.clipboard.writeText(topic.text || '');
    new Notice(this.t('notice.topicCopied'));
    return true;
  }

  /*
   * 作用：
   * 复制不带主题属性的正文区 Markdown。
   */
  async copyPlainBody() {
    const body = this.serializePlainBody();
    await navigator.clipboard.writeText(body);
    new Notice(this.t('notice.bodyCopied'));
    return true;
  }

  /*
   * 作用：
   * 复制把 # 主题级别替换成缩进后的正文。
   */
  async copyIndentedBody() {
    const body = this.plainBodyToIndentedText(this.serializePlainBody());
    await navigator.clipboard.writeText(body);
    new Notice(this.t('notice.bodyCopied'));
    return true;
  }

  /*
   * 作用：
   * 复制当前主题及所有子主题，输出为不带属性的主题级别正文。
   */
  async copyPlainSubtree(topic) {
    if (!topic) return false;

    await navigator.clipboard.writeText(this.serializePlainTopic(topic, 0));
    new Notice(this.t('notice.bodyCopied'));
    return true;
  }

  /*
   * 作用：
   * 复制当前主题及所有子主题，输出为缩进正文。
   */
  async copyIndentedSubtree(topic) {
    if (!topic) return false;

    const body = this.plainBodyToIndentedText(this.serializePlainTopic(topic, 0));
    await navigator.clipboard.writeText(body);
    new Notice(this.t('notice.bodyCopied'));
    return true;
  }

  /*
   * 作用：
   * 复制当前完整 yxmm 源码，包含配置区和主题属性。
   */
  async copyFullSource() {
    await navigator.clipboard.writeText(this.source || '');
    new Notice(this.t('notice.sourceCopied'));
    return true;
  }

  /*
   * 作用：
   * 复制当前 yxmm 配置区源码。
   */
  async copyConfigSource() {
    const sections = this.splitSourceForEditor(this.source || '');
    await navigator.clipboard.writeText(sections.config || '');
    new Notice(this.t('notice.configCopied'));
    return true;
  }

  /*
   * 作用：
   * 导出完整导图为 PNG 文件。
   */
  async exportMapPng() {
    const blob = await this.renderMapPngBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.exportFileBaseName()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    new Notice(this.t('notice.imageExported'));
    return true;
  }

  /*
   * 作用：
   * 把完整导图 PNG 写入系统剪贴板。
   */
  async copyMapPng() {
    const blob = await this.renderMapPngBlob();
    if (await this.writeImageBlobToElectronClipboard(blob)) {
      new Notice(this.t('notice.imageCopied'));
      return true;
    }

    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      new Notice(this.t('notice.imageClipboardUnsupported'));
      return false;
    }

    try {
      await this.focusForClipboardWrite();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch (error) {
      if (
        String(error?.message || error)
          .toLowerCase()
          .includes('document is not focused')
      ) {
        new Notice(this.t('notice.imageClipboardFocusRequired'));
        return false;
      }
      throw error;
    }
    new Notice(this.t('notice.imageCopied'));
    return true;
  }

  /*
   * 作用：
   * Obsidian 桌面端优先使用 Electron 剪贴板，避免浏览器 Clipboard API 的焦点限制。
   */
  async writeImageBlobToElectronClipboard(blob) {
    const electron = this.electronClipboardModule();
    if (!electron?.clipboard || !electron?.nativeImage) return false;

    const buffer = await blob.arrayBuffer();
    const image = electron.nativeImage.createFromBuffer(Buffer.from(buffer));
    if (image.isEmpty && image.isEmpty()) return false;

    electron.clipboard.writeImage(image);
    return true;
  }

  electronClipboardModule() {
    const runtimeRequire =
      typeof globalThis.require === 'function'
        ? globalThis.require
        : typeof window?.require === 'function'
          ? window.require
          : null;
    if (!runtimeRequire) return null;

    try {
      return runtimeRequire('electron');
    } catch (_error) {
      return null;
    }
  }

  async focusForClipboardWrite() {
    window.focus();
    this.svgEl?.focus?.();
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  /*
   * 作用：
   * 从当前主题树生成不带属性的正文区 Markdown。
   */
  serializePlainBody() {
    if (!this.root) return '';
    const topics = this.root._virtual ? this.root.subtopics : [this.root];
    return topics
      .map((topic) => this.serializePlainTopic(topic, 0))
      .join('\n')
      .trim();
  }

  serializePlainTopic(topic, depth) {
    const topicLevelMarker = '#'.repeat(depth + 1);
    const textLines = String(topic.text || '').split(/\r?\n/);
    const firstTextLine = textLines.shift() || '';
    const currentLine = `${topicLevelMarker} ${firstTextLine}`;
    const continuationLines = textLines.map((line) => line.trimEnd());
    const subtopicLines = topic.subtopics.map((subtopic) =>
      this.serializePlainTopic(subtopic, depth + 1)
    );
    return [currentLine, ...continuationLines, ...subtopicLines].join('\n');
  }

  plainBodyToIndentedText(body) {
    let currentLevel = 1;
    return String(body || '')
      .split(/\r?\n/)
      .map((line) => {
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        if (match) {
          currentLevel = match[1].length;
          return `${'  '.repeat(currentLevel - 1)}${match[2]}`;
        }

        if (!line.trim()) return '';
        return `${'  '.repeat(Math.max(0, currentLevel - 1))}${line}`;
      })
      .join('\n')
      .trim();
  }

  /*
   * 作用：
   * 把当前完整导图渲染成 PNG Blob，供导出和复制图片复用。
   */
  async renderMapPngBlob() {
    const exportSvg = this.createExportSvgElement();
    const svgText = new XMLSerializer().serializeToString(exportSvg);
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    try {
      const image = new Image();
      image.decoding = 'async';
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('导图图片生成失败。'));
      });
      image.src = url;
      await loaded;

      const width = Number(exportSvg.getAttribute('width')) || image.width;
      const height = Number(exportSvg.getAttribute('height')) || image.height;
      const scale = this.exportPixelScale(width, height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('PNG 导出失败。');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('PNG 导出失败。'));
          }
        }, 'image/png');
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /*
   * 作用：
   * 克隆当前导图 SVG，并整理成适合独立导出的 SVG。
   */
  createExportSvgElement() {
    if (!this.mapEl || !this.root) {
      throw new Error('当前没有可导出的导图。');
    }

    const bounds = layoutTree(this.root, this.collapsedIds, this.config).bounds;
    const viewBox = {
      x: bounds.minX - VIEWBOX_MARGIN_X,
      y: bounds.minY - VIEWBOX_MARGIN_Y,
      width: bounds.maxX - bounds.minX + VIEWBOX_MARGIN_X * 2,
      height: bounds.maxY - bounds.minY + VIEWBOX_MARGIN_Y * 2,
    };
    const exportSvg = svg('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: Math.ceil(viewBox.width),
      height: Math.ceil(viewBox.height),
      viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    });

    exportSvg.appendChild(this.createExportSvgStyle());
    exportSvg.appendChild(
      svg('rect', {
        x: viewBox.x,
        y: viewBox.y,
        width: viewBox.width,
        height: viewBox.height,
        fill: this.resolveCssColor('--background-primary', '#ffffff'),
      })
    );

    const mapClone = this.mapEl.cloneNode(true);
    this.cleanupExportMapClone(mapClone);
    this.inlineExportSvgColors(mapClone);
    exportSvg.appendChild(mapClone);
    return exportSvg;
  }

  createExportSvgStyle() {
    const styleEl = svg('style');
    styleEl.textContent = `
      .yonxao-mindmap-connector{fill:none;stroke-width:2.2;stroke-linecap:round;opacity:.62}
      .yonxao-mindmap-topic-card{stroke-width:1.4}
      .yonxao-mindmap-topic-tree-table .yonxao-mindmap-topic-card{stroke-width:1.5}
      .yonxao-mindmap-topic-tree-table-root .yonxao-mindmap-topic-card{stroke-width:2}
      .yonxao-mindmap-topic-text{letter-spacing:0;dominant-baseline:auto;user-select:none}
      .yonxao-mindmap-topic-icon path{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:2}
    `;
    return styleEl;
  }

  cleanupExportMapClone(mapClone) {
    const selectors = [
      '.yonxao-mindmap-toggle',
      '.yonxao-mindmap-topic-edit',
      '.yonxao-mindmap-topic-sibling-actions',
      '.yonxao-mindmap-topic-subtopic-add',
      '.yonxao-mindmap-drop-indicator',
      'title',
    ];
    for (const element of mapClone.querySelectorAll(selectors.join(','))) {
      element.remove();
    }
  }

  inlineExportSvgColors(mapClone) {
    const textColor = this.resolveCssColor('--text-normal', '#1f2328');
    const borderColor = this.resolveCssColor('--background-modifier-border', '#d0d7de');
    const backgroundColor = this.resolveCssColor('--background-primary', '#ffffff');

    for (const textEl of mapClone.querySelectorAll('.yonxao-mindmap-topic-text')) {
      textEl.setAttribute('fill', textColor);
    }
    for (const cardEl of mapClone.querySelectorAll('.yonxao-mindmap-topic-card')) {
      this.replaceSvgVarAttribute(cardEl, 'fill', backgroundColor);
      this.replaceSvgVarAttribute(cardEl, 'stroke', borderColor);
    }
    for (const pathEl of mapClone.querySelectorAll('.yonxao-mindmap-connector')) {
      this.replaceSvgVarAttribute(pathEl, 'stroke', textColor);
      if (!pathEl.getAttribute('stroke')) pathEl.setAttribute('stroke', textColor);
    }
    for (const iconEl of mapClone.querySelectorAll('.yonxao-mindmap-topic-icon *')) {
      this.replaceSvgVarAttribute(iconEl, 'stroke', textColor);
      this.replaceSvgVarAttribute(iconEl, 'fill', backgroundColor, { replaceMissing: false });
    }
  }

  replaceSvgVarAttribute(element, attribute, fallback, options = {}) {
    const value = element.getAttribute(attribute);
    if (
      (options.replaceMissing !== false && !value) ||
      value?.includes('var(') ||
      value === 'currentColor'
    ) {
      element.setAttribute(attribute, fallback);
    }
  }

  resolveCssColor(variableName, fallback) {
    if (!this.hostEl || typeof window === 'undefined') return fallback;
    const value = window.getComputedStyle(this.hostEl).getPropertyValue(variableName).trim();
    return value || fallback;
  }

  exportPixelScale(width, height) {
    const maxCanvasSide = 8192;
    const deviceScale =
      typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    return Math.max(0.25, Math.min(deviceScale, maxCanvasSide / width, maxCanvasSide / height));
  }

  exportFileBaseName() {
    const rootText = String(this.root?._virtual ? 'yonxao-mindmap' : this.root?.text || 'mindmap')
      .split(/\r?\n/)[0]
      .trim();
    return (rootText || 'mindmap').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
  }

  /*
   * 作用：
   * 折叠或展开一个主题的子树。
   */
  toggleTopicCollapse(topic) {
    if (!topic || !topic.subtopics.length) return;

    const id = topic.id;
    // 折叠状态只保存主题 id，不改原始树。这样重置和重新布局都很直接。
    if (this.collapsedIds.has(id)) {
      this.collapsedIds.delete(id);
    } else {
      this.collapsedIds.add(id);
    }
    this.renderMap(true);
  }

  /*
   * 作用：
   * 递归折叠当前主题及其所有有子主题的后代主题。
   */
  collapseTopicDescendants(topic) {
    this.forEachTopicWithSubtopics(topic, (current) => {
      this.collapsedIds.add(current.id);
    });
    this.renderMap(true);
  }

  /*
   * 作用：
   * 递归展开当前主题及其所有后代主题。
   */
  expandTopicDescendants(topic) {
    this.forEachTopicWithSubtopics(topic, (current) => {
      this.collapsedIds.delete(current.id);
    });
    this.renderMap(true);
  }

  /*
   * 作用：
   * 遍历当前主题和后代中所有“有子主题”的主题。
   *
   * 调用场景：
   * 右键菜单的“展开全部子主题”和“折叠全部子主题”只需要处理能折叠的主题。
   */
  forEachTopicWithSubtopics(topic, callback) {
    if (!topic || !topic.subtopics.length) return;

    callback(topic);
    for (const subtopic of topic.subtopics) {
      this.forEachTopicWithSubtopics(subtopic, callback);
    }
  }

  /*
   * 作用：
   * 处理鼠标滚轮缩放。
   *
   * 关键点：
   * 默认不拦截滚轮，让 Obsidian 页面保持正常滚动。
   * 只有配置 interaction.wheelZoom: true 时，滚轮才会缩放导图并阻止页面滚动。
   */
  handleWheel(event) {
    if (!this.viewBox) return;
    if (!this.config.interaction.wheelZoom) return;

    event.preventDefault();

    // SVG 缩放靠改 viewBox 完成，不使用 CSS transform；这样文字和线条始终清晰。
    const factor = event.deltaY > 0 ? 1.12 : 0.88;
    const point = this.clientPointToSvg(event.clientX, event.clientY);
    this.zoomViewBox(factor, point.x, point.y);
  }

  /*
   * 作用：
   * 开始平移。
   *
   * 实现逻辑：
   * 只在非主题区域响应左键拖拽，避免和主题点击/编辑冲突。
   */
  handlePanPointerDown(event) {
    if (event.button !== 0 || !this.viewBox) return;

    const target = event.target;
    const topicEl = target && target.closest ? target.closest('.yonxao-mindmap-topic') : null;
    if (topicEl) {
      const isTopicControl =
        target.closest('.yonxao-mindmap-topic-subtopic-add') ||
        target.closest('.yonxao-mindmap-topic-sibling-add') ||
        target.closest('.yonxao-mindmap-topic-edit') ||
        target.closest('.yonxao-mindmap-toggle');
      if (this.canEditMindMap() && !isTopicControl) {
        this.startPendingTopicDrag(event, topicEl);
      }
      return;
    }

    this.panState = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      startViewBox: { ...this.viewBox },
    };

    this.svgEl.classList.add('is-panning');
    try {
      this.svgEl.setPointerCapture(event.pointerId);
    } catch (_error) {
      // 某些旧版 WebView 可能不支持 Pointer Capture，忽略即可，不影响基本拖拽。
    }
  }

  /*
   * 作用：
   * 根据拖拽距离更新 SVG viewBox，实现平移。
   */
  handlePanPointerMove(event) {
    if (this.topicDragState) {
      this.handleTopicDragMove(event);
      return;
    }

    if (!this.panState || !this.viewBox) return;
    const rect = this.svgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dx = event.clientX - this.panState.clientX;
    const dy = event.clientY - this.panState.clientY;

    this.viewBox = {
      x: this.panState.startViewBox.x - (dx * this.panState.startViewBox.width) / rect.width,
      y: this.panState.startViewBox.y - (dy * this.panState.startViewBox.height) / rect.height,
      width: this.panState.startViewBox.width,
      height: this.panState.startViewBox.height,
    };
    this.applyViewBox();
  }

  /*
   * 作用：
   * 结束平移。
   */
  handlePanPointerUp(event) {
    if (this.topicDragState) {
      Promise.resolve(this.finishTopicDrag(event)).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
      return;
    }

    if (!this.panState) return;

    try {
      this.svgEl.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 没有捕获到指针时释放会失败，这里安全忽略。
    }

    this.panState = null;
    this.svgEl.classList.remove('is-panning');
  }

  /*
   * 作用：
   * 记录一次可能的主题拖拽。
   *
   * 实现逻辑：
   * pointerdown 时先不立刻拖动，等 pointermove 超过阈值再进入真正拖拽。
   * 这样单击、双击和右键菜单不会被轻微手抖误判成拖拽。
   */
  startPendingTopicDrag(event, topicEl) {
    const id = topicEl.getAttribute('data-topic-id');
    const topic = this.topicById.get(id);
    if (!topic || topic === this.root || topic._virtual) return;

    const box = topic._layout;
    this.topicDragState = {
      pointerId: event.pointerId,
      topicId: id,
      topicEl,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startSvgPoint: this.clientPointToSvg(event.clientX, event.clientY),
      originX: box.x - box.width / 2,
      originY: box.y - box.height / 2,
      started: false,
      drop: null,
      highlightEl: null,
    };
  }

  /*
   * 作用：
   * 处理主题拖拽中的移动和投放目标计算。
   */
  handleTopicDragMove(event) {
    const state = this.topicDragState;
    if (!state || event.pointerId !== state.pointerId) return;

    const clientDx = event.clientX - state.startClientX;
    const clientDy = event.clientY - state.startClientY;
    if (!state.started && Math.hypot(clientDx, clientDy) < 4) return;

    event.preventDefault();
    event.stopPropagation();

    if (!state.started) {
      this.beginTopicDrag();
    }

    const point = this.clientPointToSvg(event.clientX, event.clientY);
    const dx = point.x - state.startSvgPoint.x;
    const dy = point.y - state.startSvgPoint.y;
    state.topicEl.setAttribute(
      'transform',
      `translate(${state.originX + dx} ${state.originY + dy})`
    );

    const drop = this.findTopicDropTarget(event);
    state.drop = drop;
    this.applyTopicDropHighlight(drop);
  }

  /*
   * 作用：
   * 让主题进入真实拖拽状态，并关闭可能正在显示的编辑 UI。
   */
  beginTopicDrag() {
    const state = this.topicDragState;
    if (!state) return;

    state.started = true;
    this.closeTopicEditor();
    this.closeInlineTextEditor(false);
    this.svgEl.classList.add('is-topic-dragging');
    state.topicEl.classList.add('is-dragging');

    try {
      this.svgEl.setPointerCapture(state.pointerId);
    } catch (_error) {
      // Pointer Capture 失败时仍然能靠普通 pointermove 完成基础拖拽。
    }
  }

  /*
   * 作用：
   * 根据鼠标位置寻找当前可投放的目标主题。
   *
   * 区域规则：
   * - 目标上方 25%：插入到目标上方。
   * - 目标下方 25%：插入到目标下方。
   * - 目标中间 50%：作为目标子主题。
   */
  findTopicDropTarget(event) {
    const state = this.topicDragState;
    const movingTopic = state ? this.topicById.get(state.topicId) : null;
    if (!state || !movingTopic) return null;

    // 拖动主题本身会跟随鼠标，为了找到它下面的目标主题，临时让它不参与命中测试。
    const previousPointerEvents = state.topicEl.style.pointerEvents;
    state.topicEl.style.pointerEvents = 'none';
    const hitEl = document.elementFromPoint(event.clientX, event.clientY);
    state.topicEl.style.pointerEvents = previousPointerEvents;

    const targetEl = hitEl && hitEl.closest ? hitEl.closest('.yonxao-mindmap-topic') : null;
    if (!targetEl) return null;

    const targetId = targetEl.getAttribute('data-topic-id');
    const targetTopic = this.topicById.get(targetId);
    if (!targetTopic || targetTopic._virtual) return null;
    if (targetId === state.topicId || containsTopicId(movingTopic, targetId)) return null;

    const cardEl = targetEl.querySelector('.yonxao-mindmap-topic-card');
    const rect = cardEl ? cardEl.getBoundingClientRect() : targetEl.getBoundingClientRect();
    const axis = this.dropAxisForTopic(targetTopic);
    const ratio =
      axis === 'x'
        ? rect.width
          ? (event.clientX - rect.left) / rect.width
          : 0.5
        : rect.height
          ? (event.clientY - rect.top) / rect.height
          : 0.5;
    let placement = 'subtopic';

    if (targetTopic !== this.root) {
      if (ratio < 0.25) placement = 'before';
      if (ratio > 0.75) placement = 'after';
    }

    return {
      targetId,
      targetEl,
      placement,
      axis,
    };
  }

  /*
   * 作用：
   * 判断某个主题的兄弟排序投放区域应该按横向还是纵向切分。
   */
  dropAxisForTopic(topic) {
    const side = topic?._layout?.side;
    if (
      side === 'top' ||
      side === 'bottom' ||
      side === 'timeline-point' ||
      side === 'timeline-top' ||
      side === 'timeline-bottom' ||
      side === 'org-bottom' ||
      side === 'org-right-branch'
    ) {
      return 'x';
    }
    return 'y';
  }

  /*
   * 作用：
   * 根据当前投放目标显示拖拽反馈。
   */
  applyTopicDropHighlight(drop) {
    this.clearTopicDropHighlight();
    const state = this.topicDragState;
    if (!drop || !state) return;

    state.highlightEl = drop.targetEl;
    drop.targetEl.classList.add(`is-drop-${drop.placement}`);

    if (drop.placement === 'subtopic') return;

    const targetTopic = this.topicById.get(drop.targetId);
    const box = targetTopic && targetTopic._layout;
    if (!box) return;

    if (drop.axis === 'x') {
      const x = drop.placement === 'before' ? box.x - box.width / 2 - 8 : box.x + box.width / 2 + 8;
      this.topicDropIndicatorEl = svg('line', {
        class: 'yonxao-mindmap-drop-indicator',
        x1: x,
        y1: box.y - box.height / 2,
        x2: x,
        y2: box.y + box.height / 2,
      });
    } else {
      const y =
        drop.placement === 'before' ? box.y - box.height / 2 - 8 : box.y + box.height / 2 + 8;
      this.topicDropIndicatorEl = svg('line', {
        class: 'yonxao-mindmap-drop-indicator',
        x1: box.x - box.width / 2,
        y1: y,
        x2: box.x + box.width / 2,
        y2: y,
      });
    }
    this.mapEl.appendChild(this.topicDropIndicatorEl);
  }

  /*
   * 作用：
   * 清理拖拽目标高亮和插入线。
   */
  clearTopicDropHighlight() {
    if (this.topicDragState && this.topicDragState.highlightEl) {
      this.topicDragState.highlightEl.classList.remove(
        'is-drop-before',
        'is-drop-after',
        'is-drop-subtopic'
      );
      this.topicDragState.highlightEl = null;
    }

    if (this.topicDropIndicatorEl) {
      this.topicDropIndicatorEl.remove();
      this.topicDropIndicatorEl = null;
    }
  }

  /*
   * 作用：
   * 结束主题拖拽；如果存在合法投放目标，就移动树主题并保存。
   */
  async finishTopicDrag(event) {
    const state = this.topicDragState;
    if (!state) return;

    try {
      this.svgEl.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 未捕获指针时释放会失败，安全忽略。
    }

    const shouldMove = event.type !== 'pointercancel' && state.started && state.drop;
    const drop = state.drop;
    const movingTopicId = state.topicId;

    this.cleanupTopicDragState(state.started);

    if (!shouldMove) return;

    const moved = moveTopicInTree(this.root, movingTopicId, drop.targetId, drop.placement);
    if (!moved) {
      new Notice('yonxao-mindmap: 不能移动到这个位置。');
      this.renderMap(true);
      return;
    }

    if (drop.placement === 'subtopic') {
      this.collapsedIds.delete(drop.targetId);
    }
    this.collapsedIds.delete(movingTopicId);
    await this.saveTreeToSourceAndFile('主题已移动。');
  }

  /*
   * 作用：
   * 清理主题拖拽状态和临时 SVG 样式。
   */
  cleanupTopicDragState(wasDragging) {
    const state = this.topicDragState;
    if (!state) return;

    this.clearTopicDropHighlight();
    state.topicEl.classList.remove('is-dragging');
    this.svgEl.classList.remove('is-topic-dragging');
    state.topicEl.setAttribute('transform', `translate(${state.originX} ${state.originY})`);
    this.topicDragState = null;

    if (wasDragging) {
      this.suppressNextTopicClick = true;
    }
  }

  /*
   * 作用：
   * 根据配置决定首次渲染时使用原始大小还是适配视图。
   */
  applyConfiguredViewFit(bounds, options = {}) {
    if (this.config.view.fit === 'fit') {
      this.fitView(bounds, options);
      return;
    }

    this.showOriginalSizeView(bounds, options);
  }

  /*
   * 作用：
   * 工具栏按钮在适配视图和原始大小之间临时切换，不写入配置。
   */
  toggleViewFitMode() {
    if (this.currentViewFitMode === 'fit') {
      this.showOriginalSizeView(null, { preserveCanvasHeight: true });
      return;
    }

    this.fitView();
  }

  /*
   * 作用：
   * 用原始大小显示导图，不为了塞进幕布而缩放整张 SVG。
   */
  showOriginalSizeView(bounds, options = {}) {
    if (this.isSourceMode) {
      this.scheduleSourceModeHeight();
      return;
    }

    const currentBounds = bounds || layoutTree(this.root, this.collapsedIds, this.config).bounds;
    if (!options.preserveCanvasHeight) {
      this.updateOriginalSizeContainerHeight(currentBounds, options);
    }

    const rect = this.containerEl?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) {
      if (this.fitRetryCount < 5) {
        this.fitRetryCount += 1;
        this.scheduleFitView();
      }
      return;
    }
    this.fitRetryCount = 0;

    const focus = this.getRootFocusPoint(currentBounds);

    this.viewBox = this.getOriginalSizeViewBox(currentBounds, rect, focus.x, focus.y);
    this.currentViewFitMode = 'original';
    this.applyViewBox();
    this.updateViewFitButton();
    this.scheduleApplyToolbarPosition();
  }

  /*
   * 作用：
   * 获取当前导图的视图焦点，优先使用中心主题位置。
   */
  getRootFocusPoint(bounds) {
    const rootBox = this.root?._layout;
    if (rootBox) {
      return {
        x: rootBox.x + rootBox.width / 2,
        y: rootBox.y + rootBox.height / 2,
      };
    }

    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
  }

  /*
   * 作用：
   * 原始大小模式下不缩放文字，同时根据内容分布把中心主题放在更合适的视窗位置。
   */
  getOriginalSizeViewBox(bounds, rect, focusX, focusY) {
    const width = rect.width;
    const height = rect.height;
    const minX = bounds.minX - VIEWBOX_MARGIN_X;
    const maxX = bounds.maxX + VIEWBOX_MARGIN_X;
    const minY = bounds.minY - VIEWBOX_MARGIN_Y;
    const maxY = bounds.maxY + VIEWBOX_MARGIN_Y;
    const leftSpan = Math.max(0, focusX - minX);
    const rightSpan = Math.max(0, maxX - focusX);
    const topSpan = Math.max(0, focusY - minY);
    const bottomSpan = Math.max(0, maxY - focusY);

    return {
      x: this.getOriginalSizeAxisStart(
        minX,
        maxX,
        width,
        focusX,
        this.getOriginalSizeFocusRatio(leftSpan, rightSpan)
      ),
      y: this.getOriginalSizeAxisStart(
        minY,
        maxY,
        height,
        focusY,
        this.getOriginalSizeFocusRatio(topSpan, bottomSpan)
      ),
      width,
      height,
    };
  }

  /*
   * 作用：
   * 计算原始大小模式下某个轴的 viewBox 起点。
   */
  getOriginalSizeAxisStart(min, max, viewportSize, focus, focusRatio) {
    const contentSize = max - min;
    if (contentSize <= viewportSize) {
      return min - (viewportSize - contentSize) / 2;
    }

    return clamp(focus - viewportSize * focusRatio, min, max - viewportSize);
  }

  /*
   * 作用：
   * 内容明显偏向一侧时，让中心主题偏向反方向，给内容更多可见空间。
   */
  getOriginalSizeFocusRatio(negativeSpan, positiveSpan) {
    if (positiveSpan > negativeSpan * 1.25) return 0.32;
    if (negativeSpan > positiveSpan * 1.25) return 0.68;
    return 0.5;
  }

  /*
   * 作用：
   * 原始大小模式下根据导图实际高度调整幕布高度，但不通过改变 viewBox 来缩放文字。
   */
  updateOriginalSizeContainerHeight(bounds, options = {}) {
    if (!this.containerEl || !bounds) return;

    const contentHeight = bounds.maxY - bounds.minY + VIEWBOX_MARGIN_Y * 2;
    const minHeight = TOPIC_MIN_HEIGHT + VIEWBOX_MARGIN_Y * 2;
    const maxHeight = this.getAutoCanvasMaxHeight();
    const nextHeight = clamp(contentHeight, minHeight, maxHeight);

    if (this.manualCanvasHeight) {
      const rect = this.containerEl.getBoundingClientRect();
      const currentHeight = rect.height || Number.parseFloat(this.containerEl.style.height) || 0;
      if (!options.growManualHeight || currentHeight >= nextHeight) return;

      this.rawConfig = setMindConfigPath(this.rawConfig, ['basic', 'canvasHeight'], nextHeight);
      this.refreshNormalizedConfig();
    }

    this.containerEl.style.height = `${Math.round(nextHeight)}px`;
  }

  /*
   * 作用：
   * 根据布局边界计算并应用适配视图的视口，适配视图始终完整展示整张导图。
   */
  fitView(bounds, options = {}) {
    if (this.isSourceMode) {
      this.scheduleSourceModeHeight();
      return;
    }

    const currentBounds = bounds || layoutTree(this.root, this.collapsedIds, this.config).bounds;
    const minX = currentBounds.minX - VIEWBOX_MARGIN_X;
    const maxX = currentBounds.maxX + VIEWBOX_MARGIN_X;
    const minY = currentBounds.minY - VIEWBOX_MARGIN_Y;
    const maxY = currentBounds.maxY + VIEWBOX_MARGIN_Y;
    const width = Math.max(240, maxX - minX);
    const height = Math.max(TOPIC_MIN_HEIGHT + VIEWBOX_MARGIN_Y * 2, maxY - minY);

    this.viewBox = {
      x: minX,
      y: minY,
      width,
      height,
    };
    this.updateFitCanvasHeight(width, height, options);
    this.currentViewFitMode = 'fit';
    this.applyViewBox();
    this.updateViewFitButton();
    this.scheduleApplyToolbarPosition();
  }

  /*
   * 作用：
   * 计算自动幕布高度的上限。
   */
  getAutoCanvasMaxHeight() {
    const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
    if (this.isFullscreen) {
      return Math.max(220, viewportHeight - 32);
    }

    return Math.min(560, Math.max(220, viewportHeight * 0.7));
  }

  /*
   * 作用：
   * 适配视图下按完整导图宽高比计算自动幕布高度。
   *
   * 实现逻辑：
   * 自动高度不再套普通阅读区上限，否则整图会为了塞进有限高度而被压小。
   * 如果用户手动拖过高度，普通重绘会完全尊重手动高度。
   * 只有从源码切回导图这类明确传入 growManualHeight 的场景，才会在高度不够时自动增高。
   */
  updateFitCanvasHeight(viewBoxWidth, viewBoxHeight, options = {}) {
    if (!this.containerEl || !viewBoxWidth || !viewBoxHeight) return;

    const rect = this.containerEl.getBoundingClientRect();
    if (!rect.width) {
      if (this.fitRetryCount < 5) {
        this.fitRetryCount += 1;
        this.scheduleFitView();
      }
      return;
    }
    this.fitRetryCount = 0;

    const minHeight = TOPIC_MIN_HEIGHT + VIEWBOX_MARGIN_Y * 2;
    if (this.isFullscreen) {
      return;
    }

    const desiredHeight = Math.ceil((rect.width * viewBoxHeight) / viewBoxWidth);
    const nextHeight = Math.max(minHeight, desiredHeight);

    if (this.manualCanvasHeight) {
      const currentHeight = rect.height || Number.parseFloat(this.containerEl.style.height) || 0;
      if (!options.growManualHeight || currentHeight >= nextHeight) {
        return;
      }

      this.rawConfig = setMindConfigPath(
        this.rawConfig,
        ['basic', 'canvasHeight'],
        Math.min(CANVAS_MAX_HEIGHT, nextHeight)
      );
      this.refreshNormalizedConfig();
    }

    this.containerEl.style.height = `${nextHeight}px`;
  }

  /*
   * 作用：
   * 延迟重算当前视图，等待 DOM 完成布局后再读取容器尺寸。
   */
  scheduleFitView() {
    if (this.pendingFitFrame) return;

    const refresh = () => {
      if (this.currentViewFitMode === 'original') {
        this.showOriginalSizeView(null, { preserveCanvasHeight: true });
        return;
      }

      if (this.currentViewFitMode === 'fit') {
        this.fitView();
        return;
      }

      this.applyConfiguredViewFit();
    };

    const run = () => {
      this.pendingFitFrame = null;
      refresh();
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.pendingFitFrame = window.requestAnimationFrame(() => {
        run();
        this.scheduleApplyToolbarPosition();
        window.setTimeout(() => {
          refresh();
          this.scheduleApplyToolbarPosition();
        }, 80);
      });
    } else {
      this.pendingFitFrame = setTimeout(run, 0);
    }
  }

  /*
   * 作用：
   * 以当前视图中心为缩放中心执行缩放。
   */
  zoomAtCenter(factor) {
    if (!this.viewBox) return;
    this.zoomViewBox(
      factor,
      this.viewBox.x + this.viewBox.width / 2,
      this.viewBox.y + this.viewBox.height / 2
    );
  }

  /*
   * 作用：
   * 按给定中心点缩放视口。
   */
  zoomViewBox(factor, centerX, centerY) {
    const nextWidth = clamp(this.viewBox.width * factor, 120, 8000);
    const nextHeight = clamp(this.viewBox.height * factor, 80, 8000);
    const widthRatio = nextWidth / this.viewBox.width;
    const heightRatio = nextHeight / this.viewBox.height;

    this.viewBox = {
      x: centerX - (centerX - this.viewBox.x) * widthRatio,
      y: centerY - (centerY - this.viewBox.y) * heightRatio,
      width: nextWidth,
      height: nextHeight,
    };
    this.applyViewBox();
  }

  /*
   * 作用：
   * 把浏览器 client 坐标转换成 SVG 视口坐标。
   */
  clientPointToSvg(clientX, clientY) {
    const rect = this.svgEl.getBoundingClientRect();
    return {
      x: this.viewBox.x + ((clientX - rect.left) / rect.width) * this.viewBox.width,
      y: this.viewBox.y + ((clientY - rect.top) / rect.height) * this.viewBox.height,
    };
  }

  /*
   * 作用：
   * 把 this.viewBox 写入 SVG 元素，让缩放和平移生效。
   */
  applyViewBox() {
    if (!this.svgEl || !this.viewBox) return;
    this.svgEl.setAttribute(
      'viewBox',
      `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`
    );
  }
}
