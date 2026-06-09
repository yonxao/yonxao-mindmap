/*
 * 文件作用：
 * 这是插件的核心渲染器，负责把 yxmm 源码变成可交互的思维导图界面。
 *
 * 主要功能：
 * - 创建工具栏、SVG 画布、源码编辑区、节点编辑面板和高度拖拽手柄。
 * - 调用 parser 把 Markdown 标题源码解析成树。
 * - 调用 layout 计算节点坐标，再把节点和连线绘制成 SVG。
 * - 处理源码保存、脑图节点编辑、折叠/展开、缩放、拖动画布和高度调整。
 *
 * 调用链位置：
 * YonxaoMindmapPlugin -> new YonxaoMindmapRenderer(...) -> mount() -> renderGraph()
 */

import { Component, Notice, setIcon } from 'obsidian';

import {
  CODE_BLOCK_NAME,
  VIEWBOX_MARGIN_X,
  VIEWBOX_MARGIN_Y,
  CANVAS_MIN_HEIGHT,
  CANVAS_MAX_HEIGHT,
  NODE_MIN_HEIGHT,
  NODE_PADDING_X,
  ICON_SIZE,
} from '../constants.js';
import {
  deleteMindConfigPath,
  hasMeaningfulConfig,
  normalizeMindConfig,
  serializeMindSource,
  setMindConfigPath,
} from '../config/mindConfig.js';
import { renderIcon } from '../icons/renderIcon.js';
import { layoutTree, normalizeLayout } from '../layout/layoutTree.js';
import { replaceCodeBlockSource } from '../markdown/codeBlock.js';
import { removeNodeById, setOptionalAttr } from '../model/treeActions.js';
import { markYonxaoMindmapEmbedWrapper } from '../obsidian/embed.js';
import { assignIds, createMindNode, parseMindDocument } from '../parser/parseMind.js';
import { serializeMindDocument } from '../parser/serializeMind.js';
import { applyHeadingLevelKey } from '../source/headingKeys.js';
import { themeEdgeOpacity, themeNodeFillAlpha } from '../theme/mindThemes.js';
import { ConfigModal } from '../ui/ConfigModal.js';
import { edgeColor, nodeColor, transparentColor } from '../utils/color.js';
import { createLabeledField } from '../utils/dom.js';
import { clamp } from '../utils/math.js';
import { svg } from '../utils/svg.js';

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
    this.config = normalizeMindConfig({});
    this.hasConfigBlock = false;
    this.containerEl = null;
    this.toolbarEl = null;
    this.svgEl = null;
    this.graphEl = null;
    this.sourceEl = null;
    this.resizeHandleEl = null;
    this.sourceInputEl = null;
    this.sourceStatusEl = null;
    this.nodeEditorEl = null;
    this.nodeEditorFields = null;
    this.nodeById = new Map();
    this.collapsedIds = new Set();
    this.viewBox = null;
    this.dragState = null;
    this.resizeState = null;
    this.toolbarDragState = null;
    this.manualCanvasHeight = false;
    this.manualSourceHeight = false;
    this.isSourceMode = false;
    this.didInitialGraphRender = false;
    this.sourceDirty = false;
    this.editingNodeId = null;
    this.toggleViewButton = null;
    this.graphActionButtons = [];
    this.pendingFitFrame = null;
    this.pendingToolbarFrame = null;
    this.pendingSourceHeightFrame = null;
    this.fitRetryCount = 0;
  }

  /*
   * 作用：
   * 渲染器挂载入口，负责解析源码、创建 DOM 结构并完成首次绘制。
   *
   * 调用链：
   * Plugin code block processor -> renderer.mount()。
   *
   * 实现逻辑：
   * 先解析 source；失败时创建一个兜底根节点并切到源码模式显示错误。
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
      this.root = createMindNode('Mind', {}, []);
      assignIds(this.root, '0');
    }

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'yonxao-mindmap-container';
    this.hostEl.appendChild(this.containerEl);

    this.createToolbar();
    this.createSvg();
    this.createSourceView();
    this.createNodeEditor();
    this.createResizeHandle();
    this.applyRuntimeConfigToView();
    this.installEventBoundary();
    this.renderGraph(true);
    if (parseError) {
      this.showSourceMode(parseError);
    }
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();

    this.registerDomEvent(window, 'resize', () => {
      this.scheduleFitView();
      this.scheduleApplyToolbarPosition();
    });
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
    this.rawConfig = document.rawConfig || {};
    this.config = document.config || normalizeMindConfig({});
    this.hasConfigBlock = document.hasConfig;
    return document.root;
  }

  /*
   * 作用：
   * 把配置区里的运行时配置应用到当前 DOM 视图。
   *
   * 目前接入：
   * - canvas.height 控制画布手动高度。
   * - toolbar.x/y 控制工具栏初始位置。
   */
  applyRuntimeConfigToView() {
    this.applyConfiguredCanvasHeight();
    this.applyConfiguredViewMode();
    this.scheduleApplyToolbarPosition();
  }

  /*
   * 作用：
   * 根据配置区 canvas.height 恢复用户上次手动调整的画布高度。
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
   * 根据短时会话状态恢复源码/脑图视图。
   *
   * 为什么需要它：
   * 工具栏位置保存会写回 Markdown，Obsidian 可能因此重建代码块 DOM。
   * 如果重建后的实例不知道之前处于源码模式，就会回到默认脑图模式。
   */
  applyConfiguredViewMode() {
    const shouldUseSourceMode = this.readSessionViewMode() === 'source';
    this.isSourceMode = shouldUseSourceMode;

    if (this.containerEl) {
      this.containerEl.classList.toggle('is-source-mode', this.isSourceMode);
    }
    this.hostEl.classList.toggle('is-source-mode', this.isSourceMode);

    for (const button of this.graphActionButtons) {
      button.disabled = this.isSourceMode;
    }

    if (this.isSourceMode) {
      this.closeNodeEditor();
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
   * 用户切换源码/脑图后，后续如果拖动工具栏或调整高度触发配置保存，就能顺手保留当前模式。
   */
  rememberViewModeConfig() {
    this.writeSessionViewMode(this.isSourceMode ? 'source' : 'graph');
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
      return 'graph';
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
   * 创建左上角悬浮工具栏。
   *
   * 调用链：
   * mount() -> createToolbar() -> createToolbarButton()。
   */
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'yonxao-mindmap-toolbar';
    this.toolbarEl = toolbar;
    this.hostEl.insertBefore(toolbar, this.containerEl);

    this.createToolbarDragHandle(toolbar);

    // 源码/导图切换按钮和配置按钮始终可用；其它按钮只对导图视图有意义。
    this.toggleViewButton = this.createToolbarButton(toolbar, '显示源码', 'code-2', async () => {
      await this.toggleSourceMode();
    });

    this.createToolbarButton(toolbar, '配置', 'settings', () => {
      this.openConfigModal();
    });

    this.graphActionButtons.push(
      this.createToolbarButton(toolbar, '适配视图', 'maximize', () => this.fitView())
    );
    this.graphActionButtons.push(
      this.createToolbarButton(toolbar, '放大', 'zoom-in', () => this.zoomAtCenter(0.82))
    );
    this.graphActionButtons.push(
      this.createToolbarButton(toolbar, '缩小', 'zoom-out', () => this.zoomAtCenter(1.18))
    );
    this.graphActionButtons.push(
      this.createToolbarButton(toolbar, '重置', 'refresh-cw', () => {
        this.collapsedIds.clear();
        this.renderGraph(true);
      })
    );

    this.updateToggleViewButton();
  }

  /*
   * 作用：
   * 创建工具栏拖拽手柄，用来调整工具栏位置。
   *
   * 实现逻辑：
   * 只让这个小手柄负责拖动，普通工具按钮仍然保持点击语义，避免拖拽逻辑抢走按钮点击。
   */
  createToolbarDragHandle(toolbar) {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'yonxao-mindmap-toolbar-button yonxao-mindmap-toolbar-drag-handle';
    handle.setAttribute('aria-label', '拖动工具栏');

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

    const position = this.currentToolbarPosition();
    if (!position) return;

    this.rawConfig = setMindConfigPath(this.rawConfig, ['toolbar', 'x'], Math.round(position.x));
    this.rawConfig = setMindConfigPath(this.rawConfig, ['toolbar', 'y'], Math.round(position.y));
    this.rememberViewModeConfig();
    this.scheduleApplyToolbarPosition();
    Promise.resolve(this.saveRuntimeConfigToFile()).catch((error) => {
      new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
    });
  }

  /*
   * 作用：
   * 从配置区恢复工具栏位置；没有配置时使用 CSS 默认左上角。
   */
  applyToolbarPosition() {
    if (!this.toolbarEl) return;

    const { x, y } = this.config.toolbar;
    if (x === null || y === null) {
      this.toolbarEl.style.left = '';
      this.toolbarEl.style.top = '';
      return;
    }

    this.setToolbarPosition(x, y);
  }

  /*
   * 作用：
   * 延迟一帧恢复工具栏位置。
   *
   * 为什么要延迟：
   * Obsidian 保存代码块后可能会立刻重建预览 DOM；新 DOM 刚创建时，host/container 的尺寸还未稳定。
   * 如果这时立刻 clamp toolbar.x/y，位置可能被误夹到左上角，看起来就像拖动后“闪回”。
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
   * 设置工具栏坐标，并限制在插件宿主区域内。
   */
  setToolbarPosition(x, y) {
    if (!this.toolbarEl || !this.hostEl) return;

    const hostRect = this.hostEl.getBoundingClientRect();
    const toolbarRect = this.toolbarEl.getBoundingClientRect();
    if (!hostRect.width || !hostRect.height || !toolbarRect.width || !toolbarRect.height) {
      this.scheduleApplyToolbarPosition();
      return;
    }

    const maxX = Math.max(0, hostRect.width - toolbarRect.width - 4);
    const maxY = Math.max(0, hostRect.height - toolbarRect.height - 4);
    const minX = Math.min(4, maxX);
    const minY = Math.min(4, maxY);

    this.toolbarEl.style.left = `${Math.round(clamp(x, minX, maxX))}px`;
    this.toolbarEl.style.top = `${Math.round(clamp(y, minY, maxY))}px`;
  }

  /*
   * 作用：
   * 读取工具栏当前坐标，供拖动结束后写入配置区。
   */
  currentToolbarPosition() {
    if (!this.toolbarEl || !this.hostEl) return null;

    const toolbarRect = this.toolbarEl.getBoundingClientRect();
    const hostRect = this.hostEl.getBoundingClientRect();
    return {
      x: toolbarRect.left - hostRect.left,
      y: toolbarRect.top - hostRect.top,
    };
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
   * - 脑图模式：以内存树为准重新序列化正文，再写入新的配置区。
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
        document = parseMindDocument(this.sourceInputEl.value);
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
    this.rawConfig = rawConfig;
    this.refreshNormalizedConfig();
    this.hasConfigBlock = shouldWriteConfig;
    this.syncSourceInput();
    this.applyRuntimeConfigToView();

    if (this.isSourceMode) {
      this.scheduleSourceModeHeight();
    } else {
      this.renderGraph(true);
    }

    new Notice('yonxao-mindmap: 配置已保存。');
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
     * 这里做一个“事件边界”：事件仍然可以在插件内部正常流动，所以工具栏、SVG 节点、源码编辑框都能工作；
     * 但事件到达 yonxao-mindmap 根元素后就停止，不再交给 CodeMirror/Obsidian 的嵌入块控制层。
     * 阅读视图里启用这个边界也没有副作用，因为它只作用于当前脑图容器内部。
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
   * 在源码视图和脑图视图之间切换。
   *
   * 实现逻辑：
   * 如果源码视图有未保存内容，切回脑图前先尝试保存，保证两种视图状态一致。
   */
  async toggleSourceMode() {
    // 如果用户在源码视图已经改过内容，切回脑图前先尝试保存。
    // 这样可以保证“脑图视图看到的内容”和“Markdown 文件里的源码”是一致的。
    if (this.isSourceMode && this.sourceDirty) {
      const saved = await this.saveFromSourceView();
      if (!saved) return;
    }

    this.isSourceMode = !this.isSourceMode;
    this.containerEl.classList.toggle('is-source-mode', this.isSourceMode);
    this.hostEl.classList.toggle('is-source-mode', this.isSourceMode);
    this.rememberViewModeConfig();

    // 源码视图只是用来核对 yxmm 文本，缩放/适配这些 SVG 操作在这里禁用掉。
    for (const button of this.graphActionButtons) {
      button.disabled = this.isSourceMode;
    }

    if (this.isSourceMode) {
      this.closeNodeEditor();
      this.syncSourceInput();
      this.scheduleSourceModeHeight();
    } else {
      this.applyConfiguredCanvasHeight();
      this.renderGraph(true);
    }

    this.updateToggleViewButton();
  }

  /*
   * 作用：
   * 强制显示源码视图，并在状态栏展示解析错误或提示。
   *
   * 调用链：
   * mount() 解析失败或源码为空时调用。
   */
  showSourceMode(statusMessage) {
    this.isSourceMode = true;
    this.containerEl.classList.add('is-source-mode');
    this.hostEl.classList.add('is-source-mode');

    for (const button of this.graphActionButtons) {
      button.disabled = true;
    }

    this.closeNodeEditor();
    this.syncSourceInput();
    this.updateSourceStatus(statusMessage);
    this.rememberViewModeConfig();
    this.updateToggleViewButton();
    this.scheduleSourceModeHeight();
  }

  /*
   * 作用：
   * 根据当前模式更新“源码/脑图”切换按钮的图标和可访问属性。
   */
  updateToggleViewButton() {
    if (!this.toggleViewButton) return;

    const label = this.isSourceMode ? '显示思维导图' : '显示源码';
    const icon = this.isSourceMode ? 'git-branch' : 'code-2';
    this.toggleViewButton.setAttribute('aria-label', label);
    this.toggleViewButton.setAttribute('aria-pressed', String(this.isSourceMode));
    this.toggleViewButton.textContent = '';

    try {
      setIcon(this.toggleViewButton, icon);
    } catch (_error) {
      this.toggleViewButton.textContent = this.isSourceMode ? '图' : '码';
    }
  }

  /*
   * 作用：
   * 创建 SVG 画布并注册画布交互事件。
   *
   * 调用链：
   * mount() -> createSvg()；后续 renderGraph() 会向 graphEl 写入节点和连线。
   */
  createSvg() {
    this.svgEl = svg('svg', {
      class: 'yonxao-mindmap-svg',
      role: 'img',
      'aria-label': 'Mind map',
    });
    this.graphEl = svg('g', { class: 'yonxao-mindmap-graph' });
    this.svgEl.appendChild(this.graphEl);
    this.containerEl.appendChild(this.svgEl);

    this.registerDomEvent(this.svgEl, 'click', (event) => this.handleNodeClick(event));
    this.registerDomEvent(this.svgEl, 'wheel', (event) => this.handleWheel(event));
    this.registerDomEvent(this.svgEl, 'pointerdown', (event) => this.handlePointerDown(event));
    this.registerDomEvent(this.svgEl, 'pointermove', (event) => this.handlePointerMove(event));
    this.registerDomEvent(this.svgEl, 'pointerup', (event) => this.handlePointerUp(event));
    this.registerDomEvent(this.svgEl, 'pointercancel', (event) => this.handlePointerUp(event));
  }

  /*
   * 作用：
   * 创建源码模式的 textarea 和保存状态栏。
   *
   * 实现逻辑：
   * textarea 负责真实编辑；保存状态栏提示源码是否已同步回 Markdown。
   */
  createSourceView() {
    // 源码视图从只读 <pre><code> 改成可编辑的 textarea。
    // textarea 的优点是实现简单、浏览器兼容性好，并且不会把用户输入当作 HTML 解析。
    this.sourceEl = document.createElement('div');
    this.sourceEl.className = 'yonxao-mindmap-source';

    const editorEl = document.createElement('div');
    editorEl.className = 'yonxao-mindmap-source-editor';

    this.sourceInputEl = document.createElement('textarea');
    this.sourceInputEl.className = 'yonxao-mindmap-source-input';
    this.sourceInputEl.spellcheck = false;
    this.sourceInputEl.wrap = 'off';
    this.sourceInputEl.value = this.source;
    this.sourceInputEl.setAttribute('aria-label', 'yxmm source');

    this.sourceStatusEl = document.createElement('div');
    this.sourceStatusEl.className = 'yonxao-mindmap-source-status';
    this.sourceStatusEl.textContent = '源码可编辑，切回思维导图或按 Ctrl/Cmd+S 写回 Markdown。';

    editorEl.appendChild(this.sourceInputEl);
    this.sourceEl.appendChild(editorEl);
    this.sourceEl.appendChild(this.sourceStatusEl);
    this.containerEl.appendChild(this.sourceEl);

    this.registerDomEvent(this.sourceInputEl, 'input', () => {
      this.sourceDirty = this.sourceInputEl.value !== this.source;
      this.updateSourceStatus();
      this.scheduleSourceModeHeight();
    });

    this.registerDomEvent(this.sourceInputEl, 'keydown', (event) => {
      if (event.key === 'Tab') {
        if (!this.config.source.enableTabIndent) return;
        event.preventDefault();
        applyHeadingLevelKey(this.sourceInputEl, event.shiftKey);
        this.sourceDirty = this.sourceInputEl.value !== this.source;
        this.updateSourceStatus();
        this.scheduleSourceModeHeight();
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
  }

  /*
   * 作用：
   * 创建画布底部高度拖拽手柄。
   *
   * 调用链：
   * mount() -> createResizeHandle() -> handleResizePointerDown/Move/Up()。
   */
  createResizeHandle() {
    this.resizeHandleEl = document.createElement('div');
    this.resizeHandleEl.className = 'yonxao-mindmap-resize-handle';
    this.resizeHandleEl.setAttribute('role', 'separator');
    this.resizeHandleEl.setAttribute('aria-orientation', 'horizontal');
    this.resizeHandleEl.setAttribute('aria-label', '调整幕布高度');
    this.resizeHandleEl.setAttribute('title', '拖拽调整幕布高度');
    this.containerEl.appendChild(this.resizeHandleEl);

    this.registerDomEvent(this.resizeHandleEl, 'pointerdown', (event) => {
      this.handleResizePointerDown(event);
    });
    this.registerDomEvent(this.resizeHandleEl, 'pointermove', (event) => {
      this.handleResizePointerMove(event);
    });
    this.registerDomEvent(this.resizeHandleEl, 'pointerup', (event) => {
      this.handleResizePointerUp(event);
    });
    this.registerDomEvent(this.resizeHandleEl, 'pointercancel', (event) => {
      this.handleResizePointerUp(event);
    });
    this.registerDomEvent(this.resizeHandleEl, 'dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.resetCanvasHeight();
    });
  }

  /*
   * 作用：
   * 开始调整画布高度，记录拖拽起点和初始高度。
   */
  handleResizePointerDown(event) {
    if (!this.containerEl) return;

    event.preventDefault();
    event.stopPropagation();

    this.resizeState = {
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
      this.resizeHandleEl.setPointerCapture(event.pointerId);
    } catch (_error) {
      // 旧版 WebView 可能不支持 Pointer Capture，不影响基本拖拽。
    }
  }

  /*
   * 作用：
   * 根据指针移动距离实时更新容器高度。
   *
   * 实现逻辑：
   * 高度通过 clamp 限制在最小画布高度和 maxCanvasHeight 之间。
   */
  handleResizePointerMove(event) {
    if (!this.resizeState || !this.containerEl) return;

    event.preventDefault();
    const deltaY = event.clientY - this.resizeState.clientY;
    const nextHeight = clamp(
      this.resizeState.startHeight + deltaY,
      CANVAS_MIN_HEIGHT,
      this.maxCanvasHeight()
    );
    this.containerEl.style.height = `${Math.round(nextHeight)}px`;
  }

  /*
   * 作用：
   * 结束画布高度拖拽，并释放 pointer capture。
   */
  handleResizePointerUp(event) {
    if (!this.resizeState) return;

    try {
      this.resizeHandleEl.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 未捕获指针时释放会失败，可以安全忽略。
    }

    this.resizeState = null;
    if (this.containerEl) {
      this.containerEl.classList.remove('is-resizing');
      const height = Math.round(this.containerEl.getBoundingClientRect().height);
      this.rawConfig = setMindConfigPath(
        this.rawConfig,
        this.isSourceMode ? ['source', 'height'] : ['canvas', 'height'],
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
   * 计算当前窗口下允许的最大手动画布高度。
   */
  maxCanvasHeight() {
    const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
    return Math.max(CANVAS_MIN_HEIGHT, Math.min(CANVAS_MAX_HEIGHT, viewportHeight * 1.6));
  }

  /*
   * 作用：
   * 清除手动高度，恢复自动适配高度。
   */
  resetCanvasHeight() {
    if (!this.containerEl) return;

    this.manualCanvasHeight = false;
    this.manualSourceHeight = false;
    this.containerEl.style.height = '';
    this.rawConfig = deleteMindConfigPath(
      this.rawConfig,
      this.isSourceMode ? ['source', 'height'] : ['canvas', 'height']
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
    this.sourceInputEl.value = this.source;
    this.sourceDirty = false;
    this.updateSourceStatus();
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
      ? '源码已修改，切回思维导图或按 Ctrl/Cmd+S 写回 Markdown。'
      : '源码已同步到当前 Markdown 代码块。';
  }

  /*
   * 作用：
   * 延迟一帧计算源码视图高度。
   *
   * 为什么要延迟：
   * 切换源码模式时，浏览器需要先应用 is-source-mode 样式，textarea 的 scrollHeight 才是准确的。
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
   * 按源码内容撑开容器高度，让进入源码模式时尽量一次看到完整 yxmm 内容。
   *
   * 实现逻辑：
   * textarea.scrollHeight 是真实内容高度；再加上源码区 padding、状态栏高度和一点余量。
   * 这个高度只是源码模式临时视图高度，不会写入 canvas.height。
   */
  applySourceModeHeight() {
    if (!this.isSourceMode || !this.containerEl || !this.sourceEl || !this.sourceInputEl) {
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
    const inputStyle = window.getComputedStyle(this.sourceInputEl);
    const sourcePadding =
      parseFloat(sourceStyle.paddingTop || '0') + parseFloat(sourceStyle.paddingBottom || '0');
    const sourceGap = parseFloat(sourceStyle.gap || '0');
    const statusHeight = this.sourceStatusEl
      ? this.sourceStatusEl.getBoundingClientRect().height
      : 0;
    const lineHeight = parseFloat(inputStyle.lineHeight || '0') || 20;
    const lineCount = Math.max(1, this.sourceInputEl.value.split(/\r?\n/).length);
    const inputPadding =
      parseFloat(inputStyle.paddingTop || '0') + parseFloat(inputStyle.paddingBottom || '0');
    const estimatedInputHeight = lineCount * lineHeight + inputPadding;
    const inputHeight = Math.max(this.sourceInputEl.scrollHeight, estimatedInputHeight);
    const extraSpace = lineHeight * 2;
    const nextHeight = clamp(
      inputHeight + sourcePadding + sourceGap + statusHeight + extraSpace,
      CANVAS_MIN_HEIGHT,
      this.maxCanvasHeight()
    );

    this.containerEl.style.height = `${Math.round(nextHeight)}px`;
  }

  /*
   * 作用：
   * 从源码视图保存用户编辑，并重新解析、重绘脑图。
   *
   * 调用链：
   * Ctrl+S/toggleSourceMode() -> saveFromSourceView()。
   */
  async saveFromSourceView() {
    if (!this.sourceInputEl) return false;

    const nextSource = this.sourceInputEl.value;
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
    this.rawConfig = nextDocument.rawConfig || {};
    this.config = nextDocument.config || normalizeMindConfig({});
    this.hasConfigBlock = nextDocument.hasConfig;
    this.rememberViewModeConfig();
    this.collapsedIds.clear();
    this.sourceDirty = false;
    this.applyRuntimeConfigToView();
    this.updateSourceStatus('源码已保存，并已重新渲染脑图。');
    this.scheduleSourceModeHeight();
    this.renderGraph(true);
    return true;
  }

  /*
   * 作用：
   * 创建脑图节点编辑面板。
   *
   * 实现逻辑：
   * 面板编辑的是内存树节点；保存时统一序列化整棵树，避免局部拼字符串导致层级错误。
   */
  createNodeEditor() {
    // 这个编辑面板属于“脑图视图编辑器”。
    // 它不直接编辑 SVG 文本，而是编辑内存中的树节点；保存后再把整棵树序列化回 yxmm 源码。
    this.nodeEditorEl = document.createElement('div');
    this.nodeEditorEl.className = 'yonxao-mindmap-node-editor';
    this.nodeEditorEl.hidden = true;

    const titleEl = document.createElement('div');
    titleEl.className = 'yonxao-mindmap-node-editor-title';
    titleEl.textContent = '编辑节点';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'yonxao-mindmap-node-editor-input';
    textInput.placeholder = '节点文本';

    const colorInput = document.createElement('input');
    colorInput.type = 'text';
    colorInput.className = 'yonxao-mindmap-node-editor-input';
    colorInput.placeholder = '#3b82f6';

    const iconInput = document.createElement('input');
    iconInput.type = 'text';
    iconInput.className = 'yonxao-mindmap-node-editor-input';
    iconInput.placeholder = 'book';

    const layoutSelect = document.createElement('select');
    layoutSelect.className = 'yonxao-mindmap-node-editor-input';
    for (const [value, label] of [
      ['', '继承布局'],
      ['right', '右侧'],
      ['left', '左侧'],
      ['balanced', '平衡'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      layoutSelect.appendChild(option);
    }

    const actions = document.createElement('div');
    actions.className = 'yonxao-mindmap-node-editor-actions';

    const saveButton = this.createPanelButton('保存', async () => {
      await this.saveNodeEditor();
    });
    const addChildButton = this.createPanelButton('新增子节点', async () => {
      await this.addChildFromNodeEditor();
    });
    const deleteButton = this.createPanelButton('删除', async () => {
      await this.deleteNodeFromEditor();
    });
    const cancelButton = this.createPanelButton('取消', () => {
      this.closeNodeEditor();
    });

    actions.appendChild(saveButton);
    actions.appendChild(addChildButton);
    actions.appendChild(deleteButton);
    actions.appendChild(cancelButton);

    this.nodeEditorEl.appendChild(titleEl);
    this.nodeEditorEl.appendChild(createLabeledField('文本', textInput));
    this.nodeEditorEl.appendChild(createLabeledField('颜色', colorInput));
    this.nodeEditorEl.appendChild(createLabeledField('图标', iconInput));
    this.nodeEditorEl.appendChild(createLabeledField('布局', layoutSelect));
    this.nodeEditorEl.appendChild(actions);
    this.containerEl.appendChild(this.nodeEditorEl);

    this.nodeEditorFields = {
      text: textInput,
      color: colorInput,
      icon: iconInput,
      layout: layoutSelect,
      deleteButton,
    };

    this.registerDomEvent(textInput, 'keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        Promise.resolve(this.saveNodeEditor()).catch((error) => {
          new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
        });
      }
    });
  }

  /*
   * 作用：
   * 创建节点编辑面板中的普通按钮，并统一错误处理。
   */
  createPanelButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yonxao-mindmap-node-editor-button';
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
   * 打开节点编辑面板，并把选中节点数据填入表单。
   */
  openNodeEditor(node) {
    if (!node || node._virtual || !this.nodeEditorEl || !this.nodeEditorFields) {
      return;
    }

    this.editingNodeId = node.id;
    this.nodeEditorFields.text.value = node.text || '';
    this.nodeEditorFields.color.value = node.attrs.color || '';
    this.nodeEditorFields.icon.value = node.attrs.icon || '';
    this.nodeEditorFields.layout.value = normalizeLayout(node.attrs.layout) || '';
    this.nodeEditorFields.deleteButton.disabled = node === this.root;
    this.nodeEditorEl.hidden = false;
    this.nodeEditorFields.text.focus();
    this.nodeEditorFields.text.select();
  }

  /*
   * 作用：
   * 关闭节点编辑面板并清理当前编辑节点 id。
   */
  closeNodeEditor() {
    this.editingNodeId = null;
    if (this.nodeEditorEl) {
      this.nodeEditorEl.hidden = true;
    }
  }

  /*
   * 作用：
   * 保存节点编辑面板中的文本、颜色、图标和布局。
   */
  async saveNodeEditor() {
    const node = this.nodeById.get(this.editingNodeId);
    if (!node || !this.nodeEditorFields) return false;

    const text = this.nodeEditorFields.text.value.trim();
    if (!text) {
      new Notice('yonxao-mindmap: 节点文本不能为空。');
      return false;
    }

    node.text = text;
    setOptionalAttr(node.attrs, 'color', this.nodeEditorFields.color.value);
    setOptionalAttr(node.attrs, 'icon', this.nodeEditorFields.icon.value);
    setOptionalAttr(node.attrs, 'layout', this.nodeEditorFields.layout.value);

    const saved = await this.saveTreeToSourceAndFile('节点已保存。');
    if (saved) this.closeNodeEditor();
    return saved;
  }

  /*
   * 作用：
   * 在当前编辑节点下新增一个子节点并保存。
   */
  async addChildFromNodeEditor() {
    const node = this.nodeById.get(this.editingNodeId);
    if (!node) return false;

    // 新增子节点时只改树结构，不直接拼字符串。统一走 serializeMind，可以避免标题层级出错。
    const child = createMindNode('新节点', {}, [], 0, (node.level || 1) + 1);
    node.children.push(child);
    this.collapsedIds.delete(node.id);
    assignIds(this.root, '0');

    const saved = await this.saveTreeToSourceAndFile('已新增子节点。');
    if (saved) {
      this.openNodeEditor(child);
    }
    return saved;
  }

  /*
   * 作用：
   * 删除当前编辑节点并保存。
   *
   * 实现逻辑：
   * 根节点和虚拟根不能删除，避免生成空树或破坏多根结构。
   */
  async deleteNodeFromEditor() {
    const node = this.nodeById.get(this.editingNodeId);
    if (!node || node === this.root || node._virtual) {
      new Notice('yonxao-mindmap: 根节点不能在脑图视图中删除。');
      return false;
    }

    const removed = removeNodeById(this.root, node.id);
    if (!removed) return false;

    assignIds(this.root, '0');
    const saved = await this.saveTreeToSourceAndFile('节点已删除。');
    if (saved) this.closeNodeEditor();
    return saved;
  }

  /*
   * 作用：
   * 把内存树序列化为源码，并写回 Markdown 文件或编辑器上下文。
   *
   * 调用链：
   * saveNodeEditor/addChild/delete -> saveTreeToSourceAndFile()。
   */
  async saveTreeToSourceAndFile(successMessage) {
    // 脑图编辑的保存流程：
    // 1. 当前内存里的 root 已经被修改。
    // 2. serializeMindDocument(root, rawConfig) 把配置区和树重新变成 yxmm 文本。
    // 3. saveSourceToMarkdownFile(nextSource) 只替换当前 Markdown 文件里的这个代码块内容。
    // 4. 更新 textarea，保证源码视图立刻看到脑图编辑后的结果。
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
    this.renderGraph(true);
    new Notice(`yonxao-mindmap: ${successMessage || '已保存。'}`);
    return true;
  }

  /*
   * 作用：
   * 只保存运行时配置，不改变节点树正文。
   *
   * 调用场景：
   * 画布高度拖拽、工具栏位置拖拽这类交互只更新配置区。
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
        const document = parseMindDocument(this.sourceInputEl.value);
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
   * 把运行时配置覆盖到源码视图刚解析出的配置上。
   *
   * 实现逻辑：
   * 源码 textarea 里的用户配置是基础；拖动工具栏和高度调整是本次交互产生的新值。
   */
  mergeRuntimeConfig(baseConfig, runtimeConfig) {
    const next = JSON.parse(JSON.stringify(baseConfig || {}));

    for (const key of ['canvas', 'toolbar', 'source']) {
      if (!runtimeConfig || !runtimeConfig[key]) continue;
      next[key] = {
        ...(next[key] || {}),
        ...runtimeConfig[key],
      };
    }

    delete next.view;
    return next;
  }

  /*
   * 作用：
   * 生成写回 Markdown 的配置对象，移除只属于当前会话的视图模式。
   */
  documentConfigForSave(config) {
    return deleteMindConfigPath(config || {}, ['view', 'mode']);
  }

  /*
   * 作用：
   * rawConfig 变化后刷新运行时配置。
   */
  refreshNormalizedConfig() {
    this.config = normalizeMindConfig(this.rawConfig);
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
   * mount()/保存/折叠/重置 -> renderGraph()。
   */
  renderGraph(fitAfterRender) {
    this.nodeById.clear();
    this.graphEl.textContent = '';

    // 渲染分两步：先把树计算成带坐标的节点/连线，再把这些数据画成 SVG。
    // 这样解析、布局、绘制互相独立，后续要替换布局算法也更容易。
    const layout = layoutTree(this.root, this.collapsedIds, this.config);
    const edgeLayer = svg('g', { class: 'yonxao-mindmap-edges' });
    const nodeLayer = svg('g', { class: 'yonxao-mindmap-nodes' });

    for (const edge of layout.edges) {
      edgeLayer.appendChild(this.renderEdge(edge));
    }

    for (const node of layout.nodes) {
      this.nodeById.set(node.id, node);
      nodeLayer.appendChild(this.renderNode(node));
    }

    this.graphEl.appendChild(edgeLayer);
    this.graphEl.appendChild(nodeLayer);

    if (fitAfterRender || !this.viewBox) {
      this.fitView(layout.bounds);
    }

    this.didInitialGraphRender = true;
  }

  /*
   * 作用：
   * 根据父子节点布局信息绘制一条贝塞尔曲线连线。
   */
  renderEdge(edge) {
    const parentBox = edge.parent._layout;
    const childBox = edge.child._layout;
    const dir = childBox.side === 'left' ? -1 : 1;
    const startX = parentBox.x + (dir * parentBox.width) / 2;
    const startY = parentBox.y;
    const endX = childBox.x - (dir * childBox.width) / 2;
    const endY = childBox.y;
    const bend = Math.max(44, Math.abs(endX - startX) * 0.46);
    const color = edgeColor(edge.child, this.config);

    // 使用三次贝塞尔曲线连接父子节点，比直线更接近常见思维导图的视觉语言。
    return svg('path', {
      class: 'yonxao-mindmap-edge',
      d: [
        'M',
        startX,
        startY,
        'C',
        startX + dir * bend,
        startY,
        endX - dir * bend,
        endY,
        endX,
        endY,
      ].join(' '),
      stroke: color || 'currentColor',
      style: `opacity: ${themeEdgeOpacity(this.config)}`,
    });
  }

  /*
   * 作用：
   * 绘制单个思维导图节点，包括卡片、图标、文字、编辑按钮和折叠按钮。
   */
  renderNode(node) {
    const box = node._layout;
    // 每个节点都是一个 <g> 分组，组上保存 data-node-id，点击时用它反查原始树节点。
    const group = svg('g', {
      class: node.children.length
        ? 'yonxao-mindmap-node yonxao-mindmap-node-clickable'
        : 'yonxao-mindmap-node',
      transform: `translate(${box.x - box.width / 2} ${box.y - box.height / 2})`,
      'data-node-id': node.id,
    });

    const color = nodeColor(node, this.config);
    const fill = color
      ? transparentColor(color, themeNodeFillAlpha(this.config))
      : 'var(--background-primary)';
    const stroke = color || 'var(--background-modifier-border)';

    group.appendChild(
      svg('rect', {
        class: 'yonxao-mindmap-node-card',
        width: box.width,
        height: box.height,
        rx: 8,
        fill,
        stroke,
      })
    );

    if (box.icon) {
      group.appendChild(renderIcon(box.icon, NODE_PADDING_X, (box.height - ICON_SIZE) / 2, color));
    }

    const textEl = svg('text', {
      class: 'yonxao-mindmap-node-label',
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

    if (!node._virtual) {
      group.appendChild(this.renderEditButton(box));
    }

    if (node.children.length) {
      group.appendChild(this.renderToggle(node));
    }

    return group;
  }

  /*
   * 作用：
   * 绘制节点右侧或左侧的折叠/展开按钮。
   */
  renderToggle(node) {
    const box = node._layout;
    const collapsed = this.collapsedIds.has(node.id);
    const dir = box.side === 'left' ? -1 : 1;
    const cx = box.side === 'left' ? 0 : box.width;
    const toggle = svg('g', {
      class: 'yonxao-mindmap-toggle',
      transform: `translate(${cx} ${box.height / 2})`,
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
   * 绘制节点卡片右上角的 SVG 编辑按钮。
   */
  renderEditButton(box) {
    // SVG 里不能直接放 HTML button，所以这里用一个小 <g> 分组模拟“编辑按钮”。
    // 点击事件仍然通过 handleNodeClick 统一处理，避免给每个节点单独注册事件造成额外开销。
    const edit = svg('g', {
      class: 'yonxao-mindmap-node-edit',
      transform: `translate(${box.width - 28} 8)`,
    });

    const title = svg('title');
    title.textContent = '编辑节点';
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
   * 处理 SVG 节点点击：编辑按钮打开编辑器，节点本体折叠/展开子节点。
   */
  handleNodeClick(event) {
    const target = event.target;
    const nodeEl = target && target.closest ? target.closest('.yonxao-mindmap-node') : null;
    if (!nodeEl) return;

    event.preventDefault();
    event.stopPropagation();

    const id = nodeEl.getAttribute('data-node-id');
    const node = this.nodeById.get(id);
    if (!node) return;

    if (target && target.closest && target.closest('.yonxao-mindmap-node-edit')) {
      event.preventDefault();
      event.stopPropagation();
      this.openNodeEditor(node);
      return;
    }

    if (!node.children.length) return;

    // 折叠状态只保存节点 id，不改原始树。这样重置和重新布局都很直接。
    if (this.collapsedIds.has(id)) {
      this.collapsedIds.delete(id);
    } else {
      this.collapsedIds.add(id);
    }
    this.renderGraph(true);
  }

  /*
   * 作用：
   * 处理鼠标滚轮缩放。
   */
  handleWheel(event) {
    if (!this.viewBox) return;
    event.preventDefault();

    // SVG 缩放靠改 viewBox 完成，不使用 CSS transform；这样文字和线条始终清晰。
    const factor = event.deltaY > 0 ? 1.12 : 0.88;
    const point = this.clientPointToSvg(event.clientX, event.clientY);
    this.zoomViewBox(factor, point.x, point.y);
  }

  /*
   * 作用：
   * 开始画布平移拖拽。
   *
   * 实现逻辑：
   * 只在非节点区域响应左键拖拽，避免和节点点击/编辑冲突。
   */
  handlePointerDown(event) {
    if (event.button !== 0 || !this.viewBox) return;

    const target = event.target;
    if (target && target.closest && target.closest('.yonxao-mindmap-node')) return;

    this.dragState = {
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
   * 根据拖拽距离更新 SVG viewBox，实现画布平移。
   */
  handlePointerMove(event) {
    if (!this.dragState || !this.viewBox) return;
    const rect = this.svgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dx = event.clientX - this.dragState.clientX;
    const dy = event.clientY - this.dragState.clientY;

    this.viewBox = {
      x: this.dragState.startViewBox.x - (dx * this.dragState.startViewBox.width) / rect.width,
      y: this.dragState.startViewBox.y - (dy * this.dragState.startViewBox.height) / rect.height,
      width: this.dragState.startViewBox.width,
      height: this.dragState.startViewBox.height,
    };
    this.applyViewBox();
  }

  /*
   * 作用：
   * 结束画布平移拖拽。
   */
  handlePointerUp(event) {
    if (!this.dragState) return;

    try {
      this.svgEl.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 没有捕获到指针时释放会失败，这里安全忽略。
    }

    this.dragState = null;
    this.svgEl.classList.remove('is-panning');
  }

  /*
   * 作用：
   * 根据布局边界计算并应用适配视图的 viewBox。
   */
  fitView(bounds) {
    if (this.isSourceMode) {
      this.scheduleSourceModeHeight();
      return;
    }

    const currentBounds = bounds || layoutTree(this.root, this.collapsedIds, this.config).bounds;
    const width = Math.max(240, currentBounds.maxX - currentBounds.minX + VIEWBOX_MARGIN_X * 2);
    const height = Math.max(
      NODE_MIN_HEIGHT + VIEWBOX_MARGIN_Y * 2,
      currentBounds.maxY - currentBounds.minY + VIEWBOX_MARGIN_Y * 2
    );

    this.viewBox = {
      x: currentBounds.minX - VIEWBOX_MARGIN_X,
      y: currentBounds.minY - VIEWBOX_MARGIN_Y,
      width,
      height,
    };
    this.updateContainerHeight(width, height);
    this.applyViewBox();
  }

  /*
   * 作用：
   * 根据 viewBox 宽高比自动设置容器高度。
   *
   * 实现逻辑：
   * 如果用户手动拖过高度，只有“当前手动高度小于布局所需高度”时才增高。
   * 这样从源码切回脑图时能容纳新增节点，同时不会抹掉用户刻意拖大的画布高度。
   */
  updateContainerHeight(viewBoxWidth, viewBoxHeight) {
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

    const desiredHeight = Math.ceil((rect.width * viewBoxHeight) / viewBoxWidth);
    const minHeight = NODE_MIN_HEIGHT + VIEWBOX_MARGIN_Y * 2;
    const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
    const maxHeight = Math.min(560, Math.max(220, viewportHeight * 0.7));
    const nextHeight = clamp(desiredHeight, minHeight, maxHeight);

    if (this.manualCanvasHeight) {
      const currentHeight = rect.height || Number.parseFloat(this.containerEl.style.height) || 0;
      if (currentHeight >= nextHeight) {
        this.scheduleApplyToolbarPosition();
        return;
      }

      this.rawConfig = setMindConfigPath(this.rawConfig, ['canvas', 'height'], nextHeight);
      this.refreshNormalizedConfig();
    }

    this.containerEl.style.height = `${nextHeight}px`;
    this.scheduleApplyToolbarPosition();
  }

  /*
   * 作用：
   * 延迟执行 fitView，等待 DOM 完成布局后再读取容器尺寸。
   */
  scheduleFitView() {
    if (this.pendingFitFrame) return;

    const run = () => {
      this.pendingFitFrame = null;
      this.fitView();
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.pendingFitFrame = window.requestAnimationFrame(() => {
        run();
        this.scheduleApplyToolbarPosition();
        window.setTimeout(() => {
          this.fitView();
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
   * 按给定中心点缩放 viewBox。
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
   * 把浏览器 client 坐标转换成 SVG viewBox 坐标。
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
