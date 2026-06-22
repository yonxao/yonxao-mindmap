/*
 * 文件作用：
 * 大文本编辑浮层方法集合，负责多行主题文本编辑、应用和取消。
 *
 * 实现逻辑：
 * 浮层独立于属性面板，适合编辑长文本；保存后回写当前主题文本并刷新导图。
 *
 * 调用链：
 * TopicEditorPanel -> topicTextEditorMethods -> topicCommands/save chain。
 */

import { clamp } from '../../shared/rendererShared.js';

export const topicTextEditorMethods = {
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
  },

  openTopicTextEditor() {
    if (!this.topicEditorFields?.text || !this.topicTextEditorEl || !this.topicTextEditorInput) {
      return;
    }

    this.topicTextEditorInput.value = this.topicEditorFields.text.value || '';
    this.topicTextEditorEl.hidden = false;
    this.positionTopicTextEditor();
    this.topicTextEditorInput.focus();
    this.topicTextEditorInput.select();
  },

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
  },

  positionTopicTextEditor() {
    if (!this.topicTextEditorEl) return;

    const rect = this.topicTextEditorEl.getBoundingClientRect();
    const left = (window.innerWidth - rect.width) / 2;
    const top = (window.innerHeight - rect.height) / 2;
    const position = this.clampTopicTextEditorPosition(left, top, rect);
    this.topicTextEditorEl.style.left = `${Math.round(position.left)}px`;
    this.topicTextEditorEl.style.top = `${Math.round(position.top)}px`;
  },

  clampTopicTextEditorPosition(left, top, rect = null) {
    const gap = 12;
    const panelRect = rect || this.topicTextEditorEl?.getBoundingClientRect();
    const width = panelRect?.width || 520;
    const height = panelRect?.height || 420;
    return {
      left: clamp(left, gap, Math.max(gap, window.innerWidth - width - gap)),
      top: clamp(top, gap, Math.max(gap, window.innerHeight - height - gap)),
    };
  },

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
  },

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
  },

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
  },
};
