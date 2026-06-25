/*
 * 文件作用：
 * 主题内联文本编辑方法集合，负责双击编辑、定位、提交和取消。
 *
 * 实现逻辑：
 * 内联输入框覆盖在 SVG 主题位置上，保存时复用主题内容保存逻辑。
 *
 * 调用链：
 * SVG double click -> inlineTopicEditorMethods -> documentPersistenceMethods。
 */

import { Notice, clamp, normalizeTopicTextForStorage } from '../../shared/rendererShared.js';

const INLINE_EDITOR_GAP = 12;
const INLINE_EDITOR_LINE_HEIGHT = 22;
const INLINE_EDITOR_MIN_LINE_COUNT = 3;
const INLINE_EDITOR_WIDTH_OFFSET = 120;
const INLINE_EDITOR_MIN_WIDTH = 240;
const INLINE_EDITOR_ABSOLUTE_MIN_WIDTH = 180;
const INLINE_EDITOR_HEIGHT_OFFSET = 44;
const INLINE_EDITOR_MIN_HEIGHT = 86;

export const inlineTopicEditorMethods = {
  openInlineTextEditor(topic) {
    if (!this.canEditMindMap()) return;
    if (!topic || topic._virtual) return;

    this.closeTopicEditor();
    this.closeInlineTextEditor(false);

    const topicEl = Array.from(this.mapEl.querySelectorAll('.yonxao-mindmap-topic')).find(
      (element) => element.getAttribute('data-topic-id') === topic.id
    );
    const cardEl = topicEl ? topicEl.querySelector('.yonxao-mindmap-topic-card') : null;
    if (!cardEl) return;

    const cardRect = cardEl.getBoundingClientRect();
    const box = topic._layout;

    const inputEl = document.createElement('textarea');
    inputEl.className = 'yonxao-mindmap-inline-text-editor';
    inputEl.value = topic.text || '';
    inputEl.spellcheck = false;
    inputEl.setAttribute('aria-label', this.t('topicEditor.editContentAria'));

    // 编辑框使用固定 UI 字号，不跟随主题字号缩放；大字号主题直接继承会让浮层过大、阅读别扭。
    if (box && box.font) {
      inputEl.style.fontFamily = box.font.family;
    }

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
      inputEl.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    }

    this.registerDomEvent(inputEl, 'keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        Promise.resolve(this.saveInlineTextEditor()).catch((error) => {
          new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
        });
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeInlineTextEditor(false);
      }
    });

    this.registerDomEvent(inputEl, 'blur', () => {
      if (this.inlineTextEditorSaving) return;
      Promise.resolve(this.saveInlineTextEditor()).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
    });

    document.body.appendChild(inputEl);
    this.inlineTextEditorEl = inputEl;
    this.inlineTextEditorInput = inputEl;
    this.inlineEditingTopicId = topic.id;
    this.positionInlineTextEditor(cardRect, topic, box);
    inputEl.focus();
    inputEl.select();
  },

  positionInlineTextEditor(anchorRect, topic, box) {
    if (!this.inlineTextEditorEl) return;

    const lineCount = Math.max(
      INLINE_EDITOR_MIN_LINE_COUNT,
      box?.lines?.length || String(topic?.text || '').split(/\r?\n/).length || 1
    );
    const width = clamp(
      Math.max(anchorRect.width + INLINE_EDITOR_WIDTH_OFFSET, INLINE_EDITOR_MIN_WIDTH),
      INLINE_EDITOR_ABSOLUTE_MIN_WIDTH,
      Math.max(INLINE_EDITOR_ABSOLUTE_MIN_WIDTH, window.innerWidth - INLINE_EDITOR_GAP * 2)
    );
    const height = clamp(
      Math.max(
        anchorRect.height + INLINE_EDITOR_HEIGHT_OFFSET,
        lineCount * INLINE_EDITOR_LINE_HEIGHT + 34
      ),
      INLINE_EDITOR_MIN_HEIGHT,
      Math.max(INLINE_EDITOR_MIN_HEIGHT, window.innerHeight - INLINE_EDITOR_GAP * 2)
    );
    const left = anchorRect.left - Math.max(0, (width - anchorRect.width) / 2);
    const top = anchorRect.top - Math.max(0, (height - anchorRect.height) / 2);
    const position = {
      left: clamp(
        left,
        INLINE_EDITOR_GAP,
        Math.max(INLINE_EDITOR_GAP, window.innerWidth - width - INLINE_EDITOR_GAP)
      ),
      top: clamp(
        top,
        INLINE_EDITOR_GAP,
        Math.max(INLINE_EDITOR_GAP, window.innerHeight - height - INLINE_EDITOR_GAP)
      ),
    };
    this.inlineTextEditorEl.style.width = `${Math.round(width)}px`;
    this.inlineTextEditorEl.style.height = `${Math.round(height)}px`;
    this.inlineTextEditorEl.style.left = `${Math.round(position.left)}px`;
    this.inlineTextEditorEl.style.top = `${Math.round(position.top)}px`;
  },

  async saveInlineTextEditor() {
    if (!this.canEditMindMap()) return false;

    const inputEl = this.inlineTextEditorInput;
    const topic = this.topicById.get(this.inlineEditingTopicId);
    if (!inputEl || !topic) return false;

    const nextText = normalizeTopicTextForStorage(inputEl.value);
    if (!nextText) {
      new Notice(this.t('notice.topicContentRequired'));
      inputEl.focus();
      return false;
    }

    if (nextText === (topic.text || '')) {
      this.closeInlineTextEditor(false);
      return true;
    }

    this.inlineTextEditorSaving = true;
    topic.text = nextText;
    this.closeInlineTextEditor(false);

    try {
      return await this.saveTreeToSourceAndFile(this.t('notice.topicContentSaved'));
    } finally {
      this.inlineTextEditorSaving = false;
    }
  },

  closeInlineTextEditor(saveOnClose = false) {
    if (saveOnClose && this.inlineTextEditorEl) {
      Promise.resolve(this.saveInlineTextEditor()).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
      return;
    }

    const editorEl = this.inlineTextEditorEl;
    this.inlineTextEditorEl = null;
    this.inlineTextEditorInput = null;
    this.inlineEditingTopicId = null;
    if (editorEl?.parentNode) {
      editorEl.parentNode.removeChild(editorEl);
    }
  },
};
