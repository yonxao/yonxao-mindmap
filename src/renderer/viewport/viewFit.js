/*
 * 文件作用：
 * 视图适配方法集合，负责适配视图、原始大小、最大放大倍数和重试测量。
 *
 * 实现逻辑：
 * 根据 layout bounds 与容器尺寸计算 viewBox，并在容器宽度变化后安排延迟校正。
 *
 * 调用链：
 * 渲染完成/工具栏按钮/ResizeObserver -> viewFitMethods。
 */

import {
  VIEWBOX_MARGIN_X,
  VIEWBOX_MARGIN_Y,
  CANVAS_MAX_HEIGHT,
  TOPIC_MIN_HEIGHT,
  setMindConfigPath,
  layoutTree,
  clamp,
  AUTO_CANVAS_MAX_HEIGHT,
  AUTO_CANVAS_FALLBACK_VIEWPORT_HEIGHT,
  AUTO_CANVAS_MIN_HEIGHT,
  AUTO_CANVAS_VIEWPORT_HEIGHT_RATIO,
  MAX_VIEW_FIT_RETRY,
  MIN_FIT_VIEWPORT_WIDTH,
  VIEWBOX_MIN_DIMENSION,
  VIEWBOX_MAX_DIMENSION,
  VIEW_FIT_REFRESH_DELAY_MS,
  FULLSCREEN_VIEWPORT_OFFSET,
  FOCUS_RATIO_BIAS_THRESHOLD,
  FOCUS_RATIO_BIASED,
  FOCUS_RATIO_CENTER,
} from '../../shared/rendererShared.js';
import { canvasToMapX, canvasToMapY } from './viewportMath.js';

export const viewFitMethods = {
  applyConfiguredViewFit(bounds, options = {}) {
    if (this.config.view.fit === 'fit') {
      this.fitView(bounds, options);
      return;
    }

    this.showOriginalSizeView(bounds, options);
  },

  toggleViewFitMode() {
    if (this.currentViewFitMode === 'fit') {
      this.showOriginalSizeView();
    } else {
      this.fitView();
    }
    // 兜底刷新按钮 tooltip，防止子方法因边界条件提前返回未更新
    this.updateViewFitButton();
  },

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
      if (this.fitRetryCount < MAX_VIEW_FIT_RETRY) {
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
  },

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
  },

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
  },

  getOriginalSizeAxisStart(min, max, viewportSize, focus, focusRatio) {
    const contentSize = max - min;
    if (contentSize <= viewportSize) {
      return min - (viewportSize - contentSize) / 2;
    }

    return clamp(focus - viewportSize * focusRatio, min, max - viewportSize);
  },

  /*
   * 作用：
   * 根据导图内容在焦点两侧的分布比例，计算焦点在视口中的水平/垂直位置偏移比例。
   *
   * 业务规则：
   * - 当一侧内容明显多于另一侧（超过 1.25 倍）时，焦点向对侧偏移（32% / 68%），
   *   让内容多的一侧有更多展示空间。
   * - 两侧相对均衡时焦点居中（50%）。
   */
  getOriginalSizeFocusRatio(negativeSpan, positiveSpan) {
    if (positiveSpan > negativeSpan * FOCUS_RATIO_BIAS_THRESHOLD) return FOCUS_RATIO_BIASED;
    if (negativeSpan > positiveSpan * FOCUS_RATIO_BIAS_THRESHOLD) return 1 - FOCUS_RATIO_BIASED;
    return FOCUS_RATIO_CENTER;
  },

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

      this.rawConfig = setMindConfigPath(this.rawConfig, ['display', 'canvasHeight'], nextHeight);
      this.refreshNormalizedConfig();
    }

    this.containerEl.style.height = `${Math.round(nextHeight)}px`;
  },

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
    const width = Math.max(MIN_FIT_VIEWPORT_WIDTH, maxX - minX);
    const height = Math.max(TOPIC_MIN_HEIGHT + VIEWBOX_MARGIN_Y * 2, maxY - minY);
    const viewBox = this.getFitViewBox({ x: minX, y: minY, width, height });

    this.viewBox = viewBox;
    this.updateFitCanvasHeight(viewBox.width, viewBox.height, options);
    this.currentViewFitMode = 'fit';
    this.applyViewBox();
    this.updateViewFitButton();
    this.scheduleApplyToolbarPosition();
  },

  getFitViewBox(contentViewBox) {
    if (this.isFullscreen || this.isWindowFullscreen || !this.containerEl) return contentViewBox;

    const rect = this.containerEl.getBoundingClientRect();
    if (!rect.width) return contentViewBox;

    const maxScale = this.config.view.fitNoUpscale ? 1 : this.config.view.fitMaxScale;
    const minWidthForScale = rect.width / maxScale;
    const width = Math.max(contentViewBox.width, minWidthForScale);

    return {
      x: contentViewBox.x - (width - contentViewBox.width) / 2,
      y: contentViewBox.y,
      width,
      height: contentViewBox.height,
    };
  },

  getAutoCanvasMaxHeight() {
    const viewportHeight =
      typeof window === 'undefined' ? AUTO_CANVAS_FALLBACK_VIEWPORT_HEIGHT : window.innerHeight;
    if (this.isFullscreen || this.isWindowFullscreen) {
      return Math.max(AUTO_CANVAS_MIN_HEIGHT, viewportHeight - FULLSCREEN_VIEWPORT_OFFSET);
    }

    return Math.min(
      AUTO_CANVAS_MAX_HEIGHT,
      Math.max(AUTO_CANVAS_MIN_HEIGHT, viewportHeight * AUTO_CANVAS_VIEWPORT_HEIGHT_RATIO)
    );
  },

  updateFitCanvasHeight(viewBoxWidth, viewBoxHeight, options = {}) {
    if (!this.containerEl || !viewBoxWidth || !viewBoxHeight) return;

    const rect = this.containerEl.getBoundingClientRect();
    if (!rect.width) {
      if (this.fitRetryCount < MAX_VIEW_FIT_RETRY) {
        this.fitRetryCount += 1;
        this.scheduleFitView();
      }
      return;
    }
    this.fitRetryCount = 0;

    const minHeight = TOPIC_MIN_HEIGHT + VIEWBOX_MARGIN_Y * 2;
    if (this.isFullscreen || this.isWindowFullscreen) {
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
        ['display', 'canvasHeight'],
        Math.min(CANVAS_MAX_HEIGHT, nextHeight)
      );
      this.refreshNormalizedConfig();
    }

    this.containerEl.style.height = `${nextHeight}px`;
  },

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
        }, VIEW_FIT_REFRESH_DELAY_MS);
      });
    } else {
      this.pendingFitFrame = setTimeout(run, 0);
    }
  },

  zoomAtCenter(factor) {
    if (!this.viewBox) return;
    this.zoomViewBox(
      factor,
      this.viewBox.x + this.viewBox.width / 2,
      this.viewBox.y + this.viewBox.height / 2
    );
  },

  zoomViewBox(factor, centerX, centerY) {
    const nextWidth = clamp(
      this.viewBox.width * factor,
      VIEWBOX_MIN_DIMENSION,
      VIEWBOX_MAX_DIMENSION
    );
    const nextHeight = clamp(
      this.viewBox.height * factor,
      VIEWBOX_MIN_DIMENSION,
      VIEWBOX_MAX_DIMENSION
    );
    const widthRatio = nextWidth / this.viewBox.width;
    const heightRatio = nextHeight / this.viewBox.height;

    this.viewBox = {
      x: centerX - (centerX - this.viewBox.x) * widthRatio,
      y: centerY - (centerY - this.viewBox.y) * heightRatio,
      width: nextWidth,
      height: nextHeight,
    };
    this.applyViewBox();
  },

  clientPointToSvg(clientX, clientY) {
    const rect = this.svgEl.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    return {
      x: canvasToMapX(canvasX, this.viewBox, rect.width),
      y: canvasToMapY(canvasY, this.viewBox, rect.height),
    };
  },

  applyViewBox() {
    if (!this.svgEl || !this.viewBox) return;
    this.svgEl.setAttribute(
      'viewBox',
      `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`
    );
  },
};
