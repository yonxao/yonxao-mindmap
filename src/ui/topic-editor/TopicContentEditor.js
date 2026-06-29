/*
 * 文件作用：
 * 大内容编辑浮层方法集合，负责多行内容编辑、应用和取消。
 *
 * 实现逻辑：
 * 浮层独立于主题编辑面板，适合编辑长内容；保存后回写当前主题内容并刷新导图。
 *
 * 调用链：
 * TopicEditorPanel -> topicContentEditorMethods -> topicCommands/save chain。
 */

import { clamp } from '../../shared/rendererShared.js';

const FLOATING_EDITOR_GAP = 12;
const FLOATING_EDITOR_DEFAULT_WIDTH = 520;
const FLOATING_EDITOR_DEFAULT_HEIGHT = 420;

export const topicContentEditorMethods = {
  createTopicContentEditor() {
    this.topicContentEditorEl = document.createElement('div');
    this.topicContentEditorEl.className = 'yonxao-mindmap-topic-content-editor';
    this.topicContentEditorEl.hidden = true;

    const titleEl = document.createElement('div');
    titleEl.className = 'yonxao-mindmap-topic-content-editor-title';
    titleEl.textContent = this.t('topicEditor.contentEditorTitle');

    const inputEl = document.createElement('textarea');
    inputEl.className =
      'yonxao-mindmap-topic-editor-input yonxao-mindmap-topic-content-editor-input';
    inputEl.placeholder = this.t('topicEditor.content');
    inputEl.spellcheck = false;

    const actions = document.createElement('div');
    actions.className = 'yonxao-mindmap-topic-editor-actions';
    const applyButton = this.createPanelButton(this.t('topicEditor.applyText'), () => {
      this.closeTopicContentEditor(true);
    });
    const cancelButton = this.createPanelButton(this.t('topicEditor.cancel'), () => {
      this.closeTopicContentEditor(false);
    });
    actions.appendChild(applyButton);
    actions.appendChild(cancelButton);

    this.topicContentEditorEl.appendChild(titleEl);
    this.topicContentEditorEl.appendChild(inputEl);
    this.topicContentEditorEl.appendChild(actions);
    document.body.appendChild(this.topicContentEditorEl);

    this.topicContentEditorInput = inputEl;

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
      this.registerDomEvent(this.topicContentEditorEl, eventName, (event) => {
        event.stopPropagation();
      });
    }

    this.registerDomEvent(titleEl, 'pointerdown', (event) => {
      this.startTopicContentEditorDrag(event);
    });
    this.registerDomEvent(titleEl, 'pointermove', (event) => {
      this.handleTopicContentEditorDragMove(event);
    });
    this.registerDomEvent(titleEl, 'pointerup', (event) => {
      this.finishTopicContentEditorDrag(event);
    });
    this.registerDomEvent(titleEl, 'pointercancel', (event) => {
      this.finishTopicContentEditorDrag(event);
    });
    this.registerDomEvent(inputEl, 'keydown', (event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        this.closeTopicContentEditor(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.closeTopicContentEditor(false);
      }
    });
  },

  openTopicContentEditor() {
    if (
      !this.topicEditorFields?.content ||
      !this.topicContentEditorEl ||
      !this.topicContentEditorInput
    ) {
      return;
    }

    this.topicContentEditorInput.value = this.topicEditorFields.content.value || '';
    // 全屏时移入全屏容器避免被遮挡
    const floatContainer = this._bodyFloatContainer?.();
    if (
      floatContainer &&
      floatContainer !== document.body &&
      this.topicContentEditorEl.parentNode !== floatContainer
    ) {
      floatContainer.appendChild(this.topicContentEditorEl);
    }
    this.topicContentEditorEl.hidden = false;
    this.positionTopicContentEditor();
    this.topicContentEditorInput.focus();
    this.topicContentEditorInput.select();
  },

  closeTopicContentEditor(apply = false) {
    if (!this.topicContentEditorEl) return;

    if (apply && this.topicEditorFields?.content && this.topicContentEditorInput) {
      this.topicEditorFields.content.value = this.topicContentEditorInput.value;
      this.topicEditorFields.content.focus();
      this.updateTopicEditorActionState();
    }

    this.topicContentEditorEl.hidden = true;
    this.topicContentEditorEl.style.left = '';
    this.topicContentEditorEl.style.top = '';
    this.topicContentEditorEl.classList.remove('is-dragging');
    this.topicContentEditorDragState = null;
  },

  positionTopicContentEditor() {
    if (!this.topicContentEditorEl) return;

    const rect = this.topicContentEditorEl.getBoundingClientRect();
    const left = (window.innerWidth - rect.width) / 2;
    const top = (window.innerHeight - rect.height) / 2;
    const position = this.clampTopicContentEditorPosition(left, top, rect);
    this.topicContentEditorEl.style.left = `${Math.round(position.left)}px`;
    this.topicContentEditorEl.style.top = `${Math.round(position.top)}px`;
  },

  clampTopicContentEditorPosition(left, top, rect = null) {
    const panelRect = rect || this.topicContentEditorEl?.getBoundingClientRect();
    const width = panelRect?.width || FLOATING_EDITOR_DEFAULT_WIDTH;
    const height = panelRect?.height || FLOATING_EDITOR_DEFAULT_HEIGHT;
    return {
      left: clamp(
        left,
        FLOATING_EDITOR_GAP,
        Math.max(FLOATING_EDITOR_GAP, window.innerWidth - width - FLOATING_EDITOR_GAP)
      ),
      top: clamp(
        top,
        FLOATING_EDITOR_GAP,
        Math.max(FLOATING_EDITOR_GAP, window.innerHeight - height - FLOATING_EDITOR_GAP)
      ),
    };
  },

  startTopicContentEditorDrag(event) {
    if (event.button !== 0 || !this.topicContentEditorEl || this.topicContentEditorEl.hidden) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect = this.topicContentEditorEl.getBoundingClientRect();
    this.topicContentEditorDragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    this.topicContentEditorEl.classList.add('is-dragging');

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (_error) {
      // Pointer Capture 不可用时仍可在标题栏范围内拖动。
    }
  },

  handleTopicContentEditorDragMove(event) {
    const state = this.topicContentEditorDragState;
    if (!state || event.pointerId !== state.pointerId || !this.topicContentEditorEl) return;

    event.preventDefault();
    event.stopPropagation();

    const nextLeft = state.startLeft + event.clientX - state.startClientX;
    const nextTop = state.startTop + event.clientY - state.startClientY;
    const position = this.clampTopicContentEditorPosition(nextLeft, nextTop);
    this.topicContentEditorEl.style.left = `${Math.round(position.left)}px`;
    this.topicContentEditorEl.style.top = `${Math.round(position.top)}px`;
  },

  finishTopicContentEditorDrag(event) {
    const state = this.topicContentEditorDragState;
    if (!state || event.pointerId !== state.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 没有捕获到指针时释放会失败，这里安全忽略。
    }

    this.topicContentEditorDragState = null;
    this.topicContentEditorEl?.classList.remove('is-dragging');
  },
};
