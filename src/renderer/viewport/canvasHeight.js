/*
 * 文件作用：
 * 幕布高度方法集合，负责自动高度、手动高度和高度拖拽保存。
 *
 * 实现逻辑：
 * 根据布局 bounds、视口和配置计算显示高度；用户拖拽后写入 basic.canvasHeight。
 *
 * 调用链：
 * 渲染/拖拽事件 -> canvasHeightMethods -> runtimeConfigSaveMethods。
 */

import {
  Notice,
  CANVAS_MIN_HEIGHT,
  CANVAS_MAX_HEIGHT,
  deleteMindConfigPath,
  setMindConfigPath,
  clamp,
} from '../../shared/rendererShared.js';

export const canvasHeightMethods = {
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
  },

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
  },

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
  },

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
  },

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
  },

  maxManualHeight() {
    const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
    return Math.max(CANVAS_MIN_HEIGHT, Math.min(CANVAS_MAX_HEIGHT, viewportHeight * 1.6));
  },

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
  },
};
