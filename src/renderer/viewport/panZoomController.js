/*
 * 文件作用：
 * 平移缩放控制方法集合，负责 wheel 缩放、指针拖动画布和平移状态维护。
 *
 * 实现逻辑：
 * 所有视口变化都通过 viewBox 修改完成，保持 SVG 坐标系和 DOM 尺寸解耦。
 *
 * 调用链：
 * SVG pointer/wheel 事件 -> panZoomControllerMethods -> viewFit/canvasHeight。
 */

import {
  Notice,
  WHEEL_ZOOM_FACTOR_OUT,
  WHEEL_ZOOM_FACTOR_IN,
} from '../../shared/rendererShared.js';

export const panZoomControllerMethods = {
  handleWheel(event) {
    if (!this.viewBox) return;
    if (!this.config.interaction.wheelZoom) return;

    event.preventDefault();

    // SVG 缩放靠改 viewBox 完成，不使用 CSS transform；这样文字和线条始终清晰。
    const factor = event.deltaY > 0 ? WHEEL_ZOOM_FACTOR_OUT : WHEEL_ZOOM_FACTOR_IN;
    const point = this.clientPointToSvg(event.clientX, event.clientY);
    this.zoomViewBox(factor, point.x, point.y);
  },

  handlePanPointerDown(event) {
    if (event.button !== 0 || !this.viewBox) return;

    const target = event.target;
    const isTopicControl =
      target?.closest &&
      (target.closest('.yonxao-mindmap-topic-subtopic-add') ||
        target.closest('.yonxao-mindmap-topic-sibling-add') ||
        target.closest('.yonxao-mindmap-topic-edit') ||
        target.closest('.yonxao-mindmap-toggle'));
    if (isTopicControl) return;

    const topicEl = target && target.closest ? target.closest('.yonxao-mindmap-topic') : null;
    if (topicEl) {
      if (this.canEditMindMap()) {
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
  },

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
  },

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
  },
};
