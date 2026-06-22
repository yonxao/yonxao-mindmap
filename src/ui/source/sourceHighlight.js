/*
 * 文件作用：
 * 源码高亮方法集合，负责主题级别标记、属性和行号的轻量高亮。
 *
 * 实现逻辑：
 * 高亮层跟随 textarea 滚动，保持纯文本编辑和视觉提示分离。
 *
 * 调用链：
 * SourceView input/scroll -> sourceHighlightMethods。
 */

import {
  appendConfigHighlightedLine,
  sourceInputCursorLineIndex,
  syncSourceCodeEditorScroll,
  updateSourceCodeEditor,
  updateSourceCodeEditorActiveLine,
} from './sourceCodeEditor.js';

export const sourceHighlightMethods = {
  updateSourceBodyEditor() {
    updateSourceCodeEditor(
      this.sourceInputEl,
      this.sourceBodyHighlightEl,
      this.sourceBodyLineNumbersEl,
      {
        renderLine: (lineEl, line) => this.appendSourceBodyHighlightedLine(lineEl, line),
      }
    );
  },

  updateSourceConfigEditor() {
    updateSourceCodeEditor(
      this.sourceConfigInputEl,
      this.sourceConfigHighlightEl,
      this.sourceConfigLineNumbersEl,
      {
        renderLine: appendConfigHighlightedLine,
      }
    );
  },

  updateSourceBodyEditorActiveLine() {
    updateSourceCodeEditorActiveLine(
      this.sourceInputEl,
      this.sourceBodyHighlightEl,
      this.sourceBodyLineNumbersEl
    );
  },

  updateSourceConfigEditorActiveLine() {
    updateSourceCodeEditorActiveLine(
      this.sourceConfigInputEl,
      this.sourceConfigHighlightEl,
      this.sourceConfigLineNumbersEl
    );
  },

  syncSourceBodyEditorScroll() {
    syncSourceCodeEditorScroll(
      this.sourceInputEl,
      this.sourceBodyHighlightEl,
      this.sourceBodyLineNumbersEl
    );
  },

  syncSourceConfigEditorScroll() {
    syncSourceCodeEditorScroll(
      this.sourceConfigInputEl,
      this.sourceConfigHighlightEl,
      this.sourceConfigLineNumbersEl
    );
  },

  appendSourceBodyHighlightedLine(lineEl, line) {
    const sourceLine = String(line);
    if (!sourceLine) {
      lineEl.appendChild(document.createTextNode('\u200b'));
      return;
    }

    const topicMatch = sourceLine.match(/^(\s*)(#{1,6})(\s+)(.*)$/);
    if (!topicMatch) {
      lineEl.classList.add(sourceLine.trim() ? 'is-continuation' : 'is-blank');
      lineEl.appendChild(document.createTextNode(sourceLine || '\u200b'));
      return;
    }

    const [, indent, marker, gap, rest] = topicMatch;
    lineEl.classList.add('is-topic-line', `is-level-${marker.length}`);
    lineEl.appendChild(document.createTextNode(indent));
    this.appendSourceToken(lineEl, marker, 'yonxao-mindmap-source-token-marker');
    lineEl.appendChild(document.createTextNode(gap));

    const attributeMatch = rest.match(/^(.*?)(\s+\[[^\]]+\])$/);
    if (!attributeMatch) {
      this.appendSourceToken(lineEl, rest || '\u200b', 'yonxao-mindmap-source-token-topic');
      return;
    }

    this.appendSourceToken(lineEl, attributeMatch[1], 'yonxao-mindmap-source-token-topic');
    this.appendSourceToken(lineEl, attributeMatch[2], 'yonxao-mindmap-source-token-attribute');
  },

  appendSourceToken(parentEl, text, className) {
    const spanEl = document.createElement('span');
    spanEl.className = className;
    spanEl.textContent = text;
    parentEl.appendChild(spanEl);
  },

  sourceInputCursorLineIndex() {
    return sourceInputCursorLineIndex(this.sourceInputEl);
  },
};
