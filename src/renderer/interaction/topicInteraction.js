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

import {
  Notice,
  containsTopicId,
  findTopicContext,
  MINDMAP_LAYOUT_TYPES,
  moveTopicInTree,
  svg,
  DRAG_START_THRESHOLD,
  DROP_INDICATOR_OFFSET,
  DROP_BEFORE_THRESHOLD,
  DROP_AFTER_THRESHOLD,
} from '../../shared/rendererShared.js';

const MAP_KEYBOARD_NAV_DIRECTIONS = {
  ArrowLeft: { axis: 'x', sign: -1 },
  ArrowRight: { axis: 'x', sign: 1 },
  ArrowUp: { axis: 'y', sign: -1 },
  ArrowDown: { axis: 'y', sign: 1 },
};

/*
 * 这两个集合不是布局系统的新分组，而是键盘导航语义分组：
 * 水平思维导图用左右表达父子关系，垂直思维导图用上下表达父子关系。
 */
const HORIZONTAL_MINDMAP_KEYBOARD_LAYOUTS = new Set([
  'mindmap-right',
  'mindmap-left',
  'mindmap-bidirectional',
]);
const VERTICAL_MINDMAP_KEYBOARD_LAYOUTS = new Set([
  'mindmap-up',
  'mindmap-down',
  'mindmap-vertical',
]);
const MINDMAP_KEYBOARD_LAYOUTS = new Set(MINDMAP_LAYOUT_TYPES);

// 候选主题中心点必须超过这个距离，才算真正位于方向键指向的一侧。
const MAP_KEYBOARD_NAV_MIN_PRIMARY_DISTANCE = 1;
// 副方向偏移会放大计入分数，让方向键优先跳到同一行或同一列附近的主题。
const MAP_KEYBOARD_NAV_SECONDARY_WEIGHT = 2;
// 焦点主题贴近视口边缘时保留少量视觉余量，避免焦点描边贴边显示。
const MAP_KEYBOARD_FOCUS_VIEWBOX_MARGIN_RATIO = 0.08;
// 普通 Live Preview 保存后 Obsidian 可能延迟抢回焦点，稍后再补一次 SVG 焦点。
const MAP_KEYBOARD_FOCUS_RESTORE_DELAY_MS = 80;

function containsFocusTarget(containerEl, target) {
  return Boolean(
    target && containerEl && (target === containerEl || containerEl.contains?.(target))
  );
}

/*
 * 作用：
 * 给方向键候选主题打分。分数越低，表示越适合作为下一个焦点主题。
 *
 * 说明：
 * - primaryDistance 表示候选主题是否真的位于方向键指向的一侧。
 * - useBoxGap 只给非思维导图的空间导航使用，按主题边框间距算“最近”；
 *   思维导图关系导航已经先限定了父子/兄弟候选，继续按中心距离会更符合结构语义。
 */
function keyboardNavigationCandidateScore(currentBox, candidateBox, direction, options = {}) {
  const dx = candidateBox.x - currentBox.x;
  const dy = candidateBox.y - currentBox.y;
  const primaryDistance = direction.axis === 'x' ? dx * direction.sign : dy * direction.sign;
  if (primaryDistance <= MAP_KEYBOARD_NAV_MIN_PRIMARY_DISTANCE) return null;

  const secondaryDistance = direction.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
  let primaryScore = primaryDistance;
  let secondaryScore = secondaryDistance;

  if (options.useBoxGap) {
    const primarySize =
      direction.axis === 'x'
        ? (currentBox.width + candidateBox.width) / 2
        : (currentBox.height + candidateBox.height) / 2;
    const secondarySize =
      direction.axis === 'x'
        ? (currentBox.height + candidateBox.height) / 2
        : (currentBox.width + candidateBox.width) / 2;
    primaryScore = Math.max(0, primaryDistance - primarySize);
    secondaryScore = Math.max(0, secondaryDistance - secondarySize);
  }

  return {
    primaryDistance,
    score: primaryScore + secondaryScore * MAP_KEYBOARD_NAV_SECONDARY_WEIGHT,
  };
}

export const topicInteractionMethods = {
  handleMapFocus() {
    if (this.isSourceMode) return;
    // 阅读视图中不自动聚焦主题，避免焦点无法消除；编辑视图中保持原有行为，
    // SVG 获得焦点时保证至少有一个可见主题可被方向键接管。
    if (!this.canEditMindMap()) return;
    this.ensureFocusedTopic();
  },

  handleMapBlur(event) {
    if (this.shouldKeepFocusedTopicAfterMapBlur(event?.relatedTarget)) return;

    const blurFocusedTopicId = this.focusedTopicId;
    const blurFocusedTopicRevision = this.focusedTopicRevision;

    /*
     * 打开 textarea/浮动编辑面板时，部分环境的 blur.relatedTarget 会短暂为空。
     * 延迟一拍再看 document.activeElement，避免 SVG 先把当前主题焦点清掉。
     */
    window.setTimeout(() => {
      if (this.shouldKeepFocusedTopicAfterMapBlur(document.activeElement)) return;
      if (
        this.focusedTopicRevision !== blurFocusedTopicRevision ||
        this.focusedTopicId !== blurFocusedTopicId
      ) {
        return;
      }
      // 离开导图后清理视觉焦点，避免用户在源码、配置面板或 Obsidian 其他区域操作时仍看到高亮。
      this.clearFocusedTopic();
    }, 0);
  },

  shouldKeepFocusedTopicAfterMapBlur(target) {
    if (!target) return false;

    /*
     * 主题编辑器是导图焦点的延伸区域：进入这些浮层时仍保留当前主题高亮，
     * 这样保存、取消或删除后可以明确回到对应主题或父主题。
     */
    return (
      target === this.svgEl ||
      containsFocusTarget(this.inlineTextEditorEl, target) ||
      containsFocusTarget(this.topicEditorEl, target) ||
      containsFocusTarget(this.topicContentEditorEl, target)
    );
  },

  scheduleMapKeyboardFocusRestore() {
    const focusMap = () => {
      if (!this.svgEl || !this.hostEl?.isConnected || this.isSourceMode || !this.focusedTopicId) {
        return;
      }
      if (document.activeElement !== this.svgEl) {
        this.svgEl.focus({ preventScroll: true });
      }
    };

    focusMap();

    if (this.pendingMapFocusFrame) {
      window.cancelAnimationFrame(this.pendingMapFocusFrame);
    }
    if (this.pendingMapFocusTimer) {
      window.clearTimeout(this.pendingMapFocusTimer);
    }

    /*
     * 普通 Live Preview 保存后，Obsidian 可能在代码块 mount 之后又把焦点交回 CodeMirror。
     * 延迟补一次 SVG 焦点，才能让后续方向键继续进入导图快捷键处理。
     */
    if (typeof window.requestAnimationFrame === 'function') {
      this.pendingMapFocusFrame = window.requestAnimationFrame(() => {
        this.pendingMapFocusFrame = null;
        focusMap();
      });
    }
    this.pendingMapFocusTimer = window.setTimeout(() => {
      this.pendingMapFocusTimer = null;
      focusMap();
    }, MAP_KEYBOARD_FOCUS_RESTORE_DELAY_MS);
  },

  ensureFocusedTopic() {
    const currentTopic = this.topicById.get(this.focusedTopicId);
    if (currentTopic && currentTopic._layout) {
      return currentTopic;
    }

    // 初次进入导图、折叠隐藏当前主题或源码重渲染后，都需要重新选择一个可见主题。
    const fallbackTopic = this.keyboardFocusFallbackTopic();
    if (!fallbackTopic) {
      this.updateFocusedTopicId('');
      return null;
    }

    this.setFocusedTopic(fallbackTopic.id, { focusSvg: false, ensureInView: false });
    return fallbackTopic;
  },

  keyboardFocusFallbackTopic() {
    if (this.root?.id && this.topicById.has(this.root.id)) {
      return this.topicById.get(this.root.id);
    }

    for (const topic of this.topicById.values()) {
      if (topic?._layout) return topic;
    }

    return null;
  },

  normalizeFocusedTopicAfterLayout(topics) {
    if (!this.focusedTopicId) return;
    if (topics.some((topic) => topic.id === this.focusedTopicId)) return;

    // 当前焦点主题可能因折叠、删除或源码重渲染消失，此时回到一级主题保持键盘入口可用。
    const fallbackTopic =
      topics.find((topic) => topic.id === this.root?.id) || topics.find((topic) => topic?._layout);
    this.updateFocusedTopicId(fallbackTopic?.id || '');
  },

  clearFocusedTopic() {
    const previousTopicId = this.focusedTopicId;
    this.updateFocusedTopicId('');
    this.syncFocusedTopicClass(previousTopicId, '');
  },

  setFocusedTopic(topicId, options = {}) {
    const topic = this.topicById.get(topicId);
    if (!topic || !topic._layout) return false;

    const previousTopicId = this.focusedTopicId;
    const shouldFocusSvg = options.focusSvg !== false || document.activeElement === this.svgEl;
    this.updateFocusedTopicId(topic.id, { focusSvg: shouldFocusSvg });
    this.syncFocusedTopicClass(previousTopicId, topic.id);

    if (options.ensureInView) {
      this.ensureFocusedTopicInView(topic);
    }

    if (shouldFocusSvg && this.svgEl && document.activeElement !== this.svgEl) {
      this.svgEl.focus({ preventScroll: true });
    }

    return true;
  },

  updateFocusedTopicId(topicId, options = {}) {
    this.focusedTopicId = topicId || '';
    this.focusedTopicRevision += 1;
    this.rememberFocusedTopic({ focusSvg: Boolean(options.focusSvg) });
  },

  syncFocusedTopicClass(previousTopicId, nextTopicId) {
    if (previousTopicId && previousTopicId !== nextTopicId) {
      this.renderedTopicElementById(previousTopicId)?.classList.remove('is-keyboard-focused');
    }
    if (nextTopicId) {
      this.renderedTopicElementById(nextTopicId)?.classList.add('is-keyboard-focused');
    }
  },

  findKeyboardNavigationTopic(currentTopic, key) {
    if (MINDMAP_KEYBOARD_LAYOUTS.has(this.config?.layout)) {
      return this.findMindMapKeyboardNavigationTopic(currentTopic, key);
    }

    // 非思维导图布局的结构语义差异较大，先保留空间导航兜底，避免方向键完全不可用。
    const direction = MAP_KEYBOARD_NAV_DIRECTIONS[key];
    if (!direction) return null;

    return this.bestTopicInKeyboardDirection(
      currentTopic,
      Array.from(this.topicById.values()),
      direction,
      { useBoxGap: true }
    );
  },

  findMindMapKeyboardNavigationTopic(currentTopic, key) {
    const layout = this.config?.layout;

    /*
     * 思维导图的方向键按结构关系移动，而不是单纯找空间最近主题：
     * - 水平图：左右走父子关系，上下走兄弟关系。
     * - 垂直图：上下走父子关系，左右走兄弟关系。
     * 双向布局也按实际坐标方向过滤候选主题，因此根主题可以向对应方向进入某一侧分支。
     */
    if (HORIZONTAL_MINDMAP_KEYBOARD_LAYOUTS.has(layout)) {
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        return this.findMindMapParentChildNavigationTopic(currentTopic, key, 'x');
      }
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        return this.findMindMapSiblingNavigationTopic(currentTopic, key, 'y');
      }
    }

    if (VERTICAL_MINDMAP_KEYBOARD_LAYOUTS.has(layout)) {
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        return this.findMindMapParentChildNavigationTopic(currentTopic, key, 'y');
      }
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        return this.findMindMapSiblingNavigationTopic(currentTopic, key, 'x');
      }
    }

    return null;
  },

  findMindMapParentChildNavigationTopic(currentTopic, key, axis) {
    const direction = MAP_KEYBOARD_NAV_DIRECTIONS[key];
    const currentBox = currentTopic?._layout;
    if (!direction || direction.axis !== axis || !currentBox) return null;

    // 父子导航只在当前主题的可见父主题和可见子主题之间选择，不跨层级跳到其他分支。
    const parentTopic = this.findVisibleParentTopic(currentTopic.id);
    const candidates = [];

    if (parentTopic?._layout) {
      candidates.push(parentTopic);
    }

    for (const subtopic of currentTopic.subtopics || []) {
      if (this.topicById.has(subtopic.id) && subtopic?._layout) {
        candidates.push(subtopic);
      }
    }

    return this.bestTopicInKeyboardDirection(currentTopic, candidates, direction);
  },

  findMindMapSiblingNavigationTopic(currentTopic, key, axis) {
    const direction = MAP_KEYBOARD_NAV_DIRECTIONS[key];
    if (!direction || direction.axis !== axis) return null;

    // 兄弟导航只在同一个父主题的可见子主题之间移动，按当前画面方向筛选上/下或左/右。
    const parentTopic = this.findVisibleParentTopic(currentTopic.id);
    if (!parentTopic) return null;

    const siblings = (parentTopic.subtopics || [])
      .filter((topic) => topic.id !== currentTopic.id && this.topicById.has(topic.id))
      .filter((topic) => topic?._layout);

    return this.bestTopicInKeyboardDirection(currentTopic, siblings, direction);
  },

  findVisibleParentTopic(topicId, parentTopic = this.root) {
    if (!topicId || !parentTopic) return null;

    // 只沿可见主题递归，避免方向键进入已经折叠隐藏的子树。
    for (const subtopic of parentTopic.subtopics || []) {
      if (!this.topicById.has(subtopic.id)) continue;
      if (subtopic.id === topicId) return parentTopic;

      const matchedParent = this.findVisibleParentTopic(topicId, subtopic);
      if (matchedParent) return matchedParent;
    }

    return null;
  },

  findTopicParentInTree(topicId) {
    // 删除后恢复焦点需要真实父主题，不能依赖当前折叠/可见状态。
    return findTopicContext(this.root, topicId)?.parent || null;
  },

  bestTopicInKeyboardDirection(currentTopic, candidates, direction, options = {}) {
    const currentBox = currentTopic?._layout;
    if (!currentBox) return null;

    let bestTopic = null;
    let bestScore = Infinity;
    let bestPrimaryDistance = Infinity;

    for (const candidateTopic of candidates) {
      const candidateBox = candidateTopic?._layout;
      if (!candidateBox || candidateTopic.id === currentTopic.id) continue;

      const candidateScore = keyboardNavigationCandidateScore(currentBox, candidateBox, direction, {
        useBoxGap: Boolean(options.useBoxGap),
      });
      if (!candidateScore) continue;

      // 分数相同时选择主方向距离更近的主题，让同一列/同一行上的移动更稳定。
      if (
        candidateScore.score < bestScore ||
        (candidateScore.score === bestScore && candidateScore.primaryDistance < bestPrimaryDistance)
      ) {
        bestScore = candidateScore.score;
        bestPrimaryDistance = candidateScore.primaryDistance;
        bestTopic = candidateTopic;
      }
    }

    return bestTopic;
  },

  ensureFocusedTopicInView(topic) {
    const box = topic?._layout;
    if (!box || !this.viewBox) return;

    // 方向键移动焦点时只平移当前 viewBox，不重新执行 fit view，避免用户缩放比例被重置。
    const margin =
      Math.min(this.viewBox.width, this.viewBox.height) * MAP_KEYBOARD_FOCUS_VIEWBOX_MARGIN_RATIO;
    const topicMinX = box.x - box.width / 2 - margin;
    const topicMaxX = box.x + box.width / 2 + margin;
    const topicMinY = box.y - box.height / 2 - margin;
    const topicMaxY = box.y + box.height / 2 + margin;

    let nextX = this.viewBox.x;
    let nextY = this.viewBox.y;

    if (topicMinX < nextX) {
      nextX = topicMinX;
    } else if (topicMaxX > nextX + this.viewBox.width) {
      nextX = topicMaxX - this.viewBox.width;
    }

    if (topicMinY < nextY) {
      nextY = topicMinY;
    } else if (topicMaxY > nextY + this.viewBox.height) {
      nextY = topicMaxY - this.viewBox.height;
    }

    if (nextX === this.viewBox.x && nextY === this.viewBox.y) return;

    this.viewBox = {
      ...this.viewBox,
      x: nextX,
      y: nextY,
    };
    this.applyViewBox();
  },

  handleTopicPointerOver(event) {
    const topicId = this.topicIdFromTarget(event.target);
    if (!topicId) return;
    this.setHoveredTopicControls(topicId);
  },

  handleTopicPointerOut(event) {
    const topicId = this.topicIdFromTarget(event.target);
    if (!topicId) return;

    const nextTopicId = this.topicIdFromTarget(event.relatedTarget);
    if (nextTopicId === topicId) return;
    this.setHoveredTopicControls('');
  },

  setHoveredTopicControls(topicId) {
    if (this.hoveredTopicControlId === topicId) return;

    this.setTopicControlHoverClass(this.hoveredTopicControlId, false);
    this.hoveredTopicControlId = topicId || '';
    this.setTopicControlHoverClass(this.hoveredTopicControlId, true);
  },

  setTopicControlHoverClass(topicId, isHovered) {
    if (!topicId || !this.mapEl) return;

    for (const controlEl of this.mapEl.querySelectorAll('.yonxao-mindmap-topic-controls')) {
      if (controlEl.getAttribute('data-topic-id') === topicId) {
        controlEl.classList.toggle('is-topic-hovered', Boolean(isHovered));
        return;
      }
    }
  },

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

    this.setFocusedTopic(id, { focusSvg: true, ensureInView: false });

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
    if (!state.started && Math.hypot(clientDx, clientDy) < DRAG_START_THRESHOLD) return;

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
    /*
     * 放置区域划分规则：
     * - 鼠标在目标主题靠近边缘的 25% 区域内 → 放置到目标主题前面/后面（作为兄弟）
     * - 鼠标在目标主题中间的 50% 区域内 → 放置为目标主题的子主题
     * - 根主题不可前插/后插，只能作为父主题接受子主题
     */
    let placement = 'subtopic';

    if (targetTopic !== this.root) {
      if (ratio < DROP_BEFORE_THRESHOLD) placement = 'before';
      if (ratio > DROP_AFTER_THRESHOLD) placement = 'after';
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
      const x =
        drop.placement === 'before'
          ? box.x - box.width / 2 - DROP_INDICATOR_OFFSET
          : box.x + box.width / 2 + DROP_INDICATOR_OFFSET;
      this.topicDropIndicatorEl = svg('line', {
        class: 'yonxao-mindmap-drop-indicator',
        x1: x,
        y1: box.y - box.height / 2,
        x2: x,
        y2: box.y + box.height / 2,
      });
    } else {
      const y =
        drop.placement === 'before'
          ? box.y - box.height / 2 - DROP_INDICATOR_OFFSET
          : box.y + box.height / 2 + DROP_INDICATOR_OFFSET;
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
