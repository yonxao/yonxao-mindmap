/*
 * 文件作用：
 * 轻量源码编辑器 DOM 和同步辅助。
 *
 * 实现逻辑：
 * textarea 负责真实输入；行号层和文本层负责 CodeMirror 风格的视觉呈现。
 * 正文区可以传入自定义行渲染器做主题级别高亮，配置区和高级配置页则复用纯文本渲染。
 */

export function createSourceCodeEditor(inputEl, options = {}) {
  const editorEl = document.createElement('div');
  editorEl.className = ['yonxao-mindmap-source-code-editor', options.className || '']
    .filter(Boolean)
    .join(' ');
  editorEl.setAttribute('role', 'presentation');

  const highlightViewportEl = document.createElement('div');
  highlightViewportEl.className = 'yonxao-mindmap-source-highlight-viewport';
  const highlightEl = document.createElement('div');
  highlightEl.className = 'yonxao-mindmap-source-highlight';
  highlightViewportEl.appendChild(highlightEl);

  const lineNumberViewportEl = document.createElement('div');
  lineNumberViewportEl.className = 'yonxao-mindmap-source-line-number-viewport';
  const lineNumbersEl = document.createElement('div');
  lineNumbersEl.className = 'yonxao-mindmap-source-line-numbers';
  lineNumberViewportEl.appendChild(lineNumbersEl);

  inputEl.classList.add('yonxao-mindmap-source-code-input');
  editorEl.appendChild(highlightViewportEl);
  editorEl.appendChild(lineNumberViewportEl);
  editorEl.appendChild(inputEl);

  return {
    editorEl,
    highlightEl,
    lineNumbersEl,
  };
}

export function updateSourceCodeEditor(inputEl, highlightEl, lineNumbersEl, options = {}) {
  if (!inputEl || !highlightEl || !lineNumbersEl) return;

  const renderLine = options.renderLine || appendPlainSourceLine;
  const activeLineIndex = sourceInputCursorLineIndex(inputEl);
  const highlightFragment = document.createDocumentFragment();
  const lineNumberFragment = document.createDocumentFragment();

  inputEl.value.split(/\r?\n/).forEach((line, index) => {
    const isActive = index === activeLineIndex;

    const lineEl = document.createElement('div');
    lineEl.className = 'yonxao-mindmap-source-highlight-line';
    if (isActive) lineEl.classList.add('is-active-line');
    renderLine(lineEl, line);
    highlightFragment.appendChild(lineEl);

    const lineNumberEl = document.createElement('div');
    lineNumberEl.className = 'yonxao-mindmap-source-line-number';
    if (isActive) lineNumberEl.classList.add('is-active-line');
    lineNumberEl.textContent = String(index + 1);
    lineNumberFragment.appendChild(lineNumberEl);
  });

  highlightEl.replaceChildren(highlightFragment);
  lineNumbersEl.replaceChildren(lineNumberFragment);
  syncSourceCodeEditorScroll(inputEl, highlightEl, lineNumbersEl);
}

export function updateSourceCodeEditorActiveLine(inputEl, highlightEl, lineNumbersEl) {
  if (!inputEl || !highlightEl || !lineNumbersEl) return;

  const activeLineIndex = sourceInputCursorLineIndex(inputEl);
  const highlightLines = Array.from(highlightEl.children);
  const lineNumbers = Array.from(lineNumbersEl.children);

  highlightLines.forEach((lineEl, index) => {
    lineEl.classList.toggle('is-active-line', index === activeLineIndex);
  });
  lineNumbers.forEach((lineEl, index) => {
    lineEl.classList.toggle('is-active-line', index === activeLineIndex);
  });
}

export function syncSourceCodeEditorScroll(inputEl, highlightEl, lineNumbersEl) {
  if (!inputEl || !highlightEl || !lineNumbersEl) return;

  highlightEl.style.transform = `translate(${-inputEl.scrollLeft}px, ${-inputEl.scrollTop}px)`;
  lineNumbersEl.style.transform = `translateY(${-inputEl.scrollTop}px)`;
}

export function sourceInputCursorLineIndex(inputEl) {
  if (!inputEl) return 0;
  return inputEl.value.slice(0, inputEl.selectionStart).split(/\r?\n/).length - 1;
}

export function appendConfigHighlightedLine(lineEl, line) {
  const sourceLine = String(line);
  if (!sourceLine.trim()) {
    lineEl.classList.add('is-blank');
    lineEl.appendChild(document.createTextNode('\u200b'));
    return;
  }

  const commentIndex = findYamlCommentIndex(sourceLine);
  const content = commentIndex >= 0 ? sourceLine.slice(0, commentIndex) : sourceLine;
  const comment = commentIndex >= 0 ? sourceLine.slice(commentIndex) : '';
  appendYamlContent(lineEl, content);
  if (comment) appendSourceToken(lineEl, comment, 'yonxao-mindmap-source-token-comment');
}

function appendPlainSourceLine(lineEl, line) {
  const sourceLine = String(line);
  if (!sourceLine.trim()) {
    lineEl.classList.add('is-blank');
  }
  lineEl.appendChild(document.createTextNode(sourceLine || '\u200b'));
}

function appendYamlContent(lineEl, content) {
  if (!content) return;

  const keyMatch = content.match(/^(\s*)([-]\s+)?([A-Za-z0-9_.-]+)(\s*:\s*)(.*)$/);
  if (!keyMatch) {
    lineEl.appendChild(document.createTextNode(content));
    return;
  }

  const [, indent, listMarker = '', key, separator, value] = keyMatch;
  lineEl.appendChild(document.createTextNode(indent));
  if (listMarker) appendSourceToken(lineEl, listMarker, 'yonxao-mindmap-source-token-yaml-marker');
  appendSourceToken(lineEl, key, 'yonxao-mindmap-source-token-yaml-key');
  appendSourceToken(lineEl, separator, 'yonxao-mindmap-source-token-yaml-separator');
  appendYamlValue(lineEl, value);
}

function appendYamlValue(lineEl, value) {
  if (!value) return;

  const leadingSpace = value.match(/^\s*/)?.[0] || '';
  const rawValue = value.slice(leadingSpace.length);
  lineEl.appendChild(document.createTextNode(leadingSpace));

  if (/^(['"]).*\1$/.test(rawValue)) {
    appendSourceToken(lineEl, rawValue, 'yonxao-mindmap-source-token-yaml-string');
    return;
  }

  if (/^(true|false|null)$/i.test(rawValue)) {
    appendSourceToken(lineEl, rawValue, 'yonxao-mindmap-source-token-yaml-literal');
    return;
  }

  if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
    appendSourceToken(lineEl, rawValue, 'yonxao-mindmap-source-token-yaml-number');
    return;
  }

  lineEl.appendChild(document.createTextNode(rawValue));
}

function findYamlCommentIndex(line) {
  let quote = '';
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const previous = line[index - 1] || '';

    if ((char === '"' || char === "'") && previous !== '\\') {
      quote = quote === char ? '' : quote || char;
      continue;
    }

    if (!quote && char === '#' && (index === 0 || /\s/.test(previous))) {
      return index;
    }
  }

  return -1;
}

function appendSourceToken(parentEl, text, className) {
  const spanEl = document.createElement('span');
  spanEl.className = className;
  spanEl.textContent = text;
  parentEl.appendChild(spanEl);
}
