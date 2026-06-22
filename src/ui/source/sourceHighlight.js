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

export const sourceHighlightMethods = {
  updateSourceBodyEditor() {
    if (!this.sourceInputEl || !this.sourceBodyHighlightEl || !this.sourceBodyLineNumbersEl) {
      return;
    }

    const lines = this.sourceInputEl.value.split(/\r?\n/);
    const activeLineIndex = this.sourceInputCursorLineIndex();
    const highlightFragment = document.createDocumentFragment();
    const lineNumberFragment = document.createDocumentFragment();

    lines.forEach((line, index) => {
      const isActive = index === activeLineIndex;

      const lineEl = document.createElement('div');
      lineEl.className = 'yonxao-mindmap-source-highlight-line';
      if (isActive) lineEl.classList.add('is-active-line');
      this.appendSourceBodyHighlightedLine(lineEl, line);
      highlightFragment.appendChild(lineEl);

      const lineNumberEl = document.createElement('div');
      lineNumberEl.className = 'yonxao-mindmap-source-line-number';
      if (isActive) lineNumberEl.classList.add('is-active-line');
      lineNumberEl.textContent = String(index + 1);
      lineNumberFragment.appendChild(lineNumberEl);
    });

    this.sourceBodyHighlightEl.replaceChildren(highlightFragment);
    this.sourceBodyLineNumbersEl.replaceChildren(lineNumberFragment);
    this.syncSourceBodyEditorScroll();
  },

  updateSourceBodyEditorActiveLine() {
    if (!this.sourceBodyHighlightEl || !this.sourceBodyLineNumbersEl) return;
    const activeLineIndex = this.sourceInputCursorLineIndex();
    const highlightLines = Array.from(this.sourceBodyHighlightEl.children);
    const lineNumbers = Array.from(this.sourceBodyLineNumbersEl.children);

    highlightLines.forEach((lineEl, index) => {
      lineEl.classList.toggle('is-active-line', index === activeLineIndex);
    });
    lineNumbers.forEach((lineEl, index) => {
      lineEl.classList.toggle('is-active-line', index === activeLineIndex);
    });
  },

  syncSourceBodyEditorScroll() {
    if (!this.sourceInputEl || !this.sourceBodyHighlightEl || !this.sourceBodyLineNumbersEl) {
      return;
    }

    this.sourceBodyHighlightEl.style.transform = `translate(${-this.sourceInputEl.scrollLeft}px, ${-this.sourceInputEl.scrollTop}px)`;
    this.sourceBodyLineNumbersEl.style.transform = `translateY(${-this.sourceInputEl.scrollTop}px)`;
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
    if (!this.sourceInputEl) return 0;
    return (
      this.sourceInputEl.value.slice(0, this.sourceInputEl.selectionStart).split(/\r?\n/).length - 1
    );
  },
};
