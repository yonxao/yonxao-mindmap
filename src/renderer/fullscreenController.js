/*
 * 文件作用：
 * 全屏控制方法集合，负责阅读视图覆盖层、编辑视图原生全屏和工具栏归位。
 *
 * 实现逻辑：
 * 阅读视图通过 body 级覆盖层承载 hostEl，编辑视图直接请求 hostEl 全屏，退出时恢复 DOM 位置和视口。
 *
 * 调用链：
 * 工具栏按钮/快捷操作 -> fullscreenControllerMethods -> document fullscreen API。
 */

import { Notice, svg, CONNECTOR_STROKE_WIDTH } from '../shared/rendererShared.js';

export const fullscreenControllerMethods = {
  async toggleFullscreen() {
    if (!this.hostEl || typeof document === 'undefined') return;

    if (this.isFullscreen) {
      if (typeof document.exitFullscreen === 'function') {
        await document.exitFullscreen();
      }
      return;
    }

    if (!this.canEditMindMap()) {
      this._fsOverlay = document.createElement('div');
      this._fsOverlay.className = 'yonxao-mindmap-fs-overlay';
      this._hostElParent = this.hostEl.parentNode;
      this._hostElNextSibling = this.hostEl.nextSibling;
      this._fsOverlay.appendChild(this.hostEl);
      document.body.appendChild(this._fsOverlay);
      this.moveToolbarIntoFullscreenHost();
      this.hostEl.classList.add('is-fullscreen');
      try {
        await this._fsOverlay.requestFullscreen();
      } catch (error) {
        this.cleanupFullscreenOverlay();
        throw error;
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
  },

  handleFullscreenChange() {
    if (typeof document === 'undefined') return;

    if (document.fullscreenElement) {
      if (!this.hostEl?.classList.contains('is-fullscreen')) return;
      this.applyFullscreenEntered();
    } else {
      if (!this.isFullscreen) return;
      this.cleanupFullscreenOverlay();
      this.applyFullscreenExited();
    }
  },

  cleanupFullscreenOverlay() {
    if (!this._fsOverlay) return;
    if (this._hostElParent) {
      if (this._hostElNextSibling && this._hostElNextSibling.parentNode === this._hostElParent) {
        this._hostElParent.insertBefore(this.hostEl, this._hostElNextSibling);
      } else {
        this._hostElParent.appendChild(this.hostEl);
      }
    }
    this._fsOverlay.remove();
    this._fsOverlay = null;
    this._hostElParent = null;
    this._hostElNextSibling = null;
  },

  applyFullscreenEntered() {
    this.isFullscreen = true;
    this.showToolbar();
    this.updateFullscreenButton();
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();
  },

  applyFullscreenExited() {
    this.isFullscreen = false;
    this.hostEl?.classList.remove('is-fullscreen');
    this.restoreToolbarToBody();
    this.updateFullscreenButton();
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();
  },

  moveToolbarIntoFullscreenHost() {
    if (!this.toolbarEl || !this.hostEl || this.toolbarEl.parentElement === this.hostEl) return;

    this.hostEl.appendChild(this.toolbarEl);
  },

  restoreToolbarToBody() {
    if (!this.toolbarEl || typeof document === 'undefined') return;
    if (this.toolbarEl.parentElement === document.body) return;

    document.body.appendChild(this.toolbarEl);
  },

  createSvg() {
    this.svgEl = svg('svg', {
      class: 'yonxao-mindmap-svg',
      role: 'img',
      'aria-label': 'Mind map',
      tabindex: '0',
    });
    this.svgEl.style.setProperty(
      '--yonxao-mindmap-connector-stroke-width',
      String(CONNECTOR_STROKE_WIDTH)
    );
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
  },
};
