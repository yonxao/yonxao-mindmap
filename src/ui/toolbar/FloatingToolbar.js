/*
 * 文件作用：
 * 悬浮工具栏方法集合，负责创建工具栏、显隐、拖拽入口和生命周期清理。
 *
 * 实现逻辑：
 * 工具栏挂载在 body 或全屏宿主中，通过 renderer 状态更新按钮可用性。
 *
 * 调用链：
 * YonxaoMindmapRenderer -> floatingToolbarMethods -> toolbarButtons/toolbarPosition。
 */

export const floatingToolbarMethods = {
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
  },

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
  },

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
  },

  isScrollableElement(element) {
    if (!element || element === document.documentElement) return false;
    const style = window.getComputedStyle(element);
    const overflow = `${style.overflow} ${style.overflowY} ${style.overflowX}`;
    if (!/(auto|scroll|overlay)/.test(overflow)) return false;
    return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
  },

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
  },

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
  },

  scheduleHideToolbar() {
    if (this.pendingToolbarHideTimer) {
      window.clearTimeout(this.pendingToolbarHideTimer);
    }
    this.pendingToolbarHideTimer = window.setTimeout(() => {
      this.pendingToolbarHideTimer = null;
      if (this.shouldKeepToolbarVisible()) return;
      this.hideToolbar();
    }, 140);
  },

  hideToolbar() {
    this.toolbarEl?.classList.remove('is-visible');
  },

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
  },

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
  },

  isToolbarHostNearViewport() {
    if (!this.hostEl) return false;
    const rect = this.hostEl.getBoundingClientRect();
    const margin = 64;
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
  },
};
