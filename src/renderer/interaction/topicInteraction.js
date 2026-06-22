/*
 * 文件作用：
 * 主题交互方法集合，负责点击、拖拽、放置提示和主题命中检测。
 *
 * 实现逻辑：
 * 拖拽时维护 topicDragState，并通过临时禁用命中目标自身来查找可放置的目标主题。
 *
 * 调用链：
 * SVG 主题事件 -> topicInteractionMethods -> topicTreeActions -> 重新渲染。
 */

import { Notice, containsTopicId, moveTopicInTree, svg } from '../../shared/rendererShared.js';

export const topicInteractionMethods = {
  handleTopicClick(event) {
    if (this.suppressNextTopicClick) {
      this.suppressNextTopicClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target;
    const id = this.topicIdFromTarget(target);
    if (!id) return;

    const topic = this.topicById.get(id);
    if (!topic) return;

    const canEdit = this.canEditMindMap();

    if (target && target.closest && target.closest('.yonxao-mindmap-toggle')) {
      event.preventDefault();
      event.stopPropagation();
      this.toggleTopicCollapse(topic);
      return;
    }

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

    return;
  },

  handleTopicDoubleClick(event) {
    if (!this.canEditMindMap()) return;

    const target = event.target;
    const id = this.topicIdFromTarget(target);
    if (!id) return;

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

    const topic = this.topicById.get(id);
    if (topic) {
      this.openInlineTextEditor(topic);
    }
  },

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
  },

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
  },

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
  },

  findTopicDropTarget(event) {
    const state = this.topicDragState;
    const movingTopic = state ? this.topicById.get(state.topicId) : null;
    if (!state || !movingTopic) return null;

    // 拖动主题本身会跟随鼠标，为了找到它下面的目标主题，临时让它不参与命中测试。
    const previousPointerEvents = state.topicEl.style.pointerEvents;
    state.topicEl.style.pointerEvents = 'none';
    const hitEl = document.elementFromPoint(event.clientX, event.clientY);
    state.topicEl.style.pointerEvents = previousPointerEvents;

    const targetEl = this.renderedTopicElementFromTarget(hitEl);
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
  },

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
  },

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
  },

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
  },

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
  },

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
  },
};
