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
  appendSourceToken,
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

    // 优先检查当前行是否为 `@structures`/`@end`/`@relation`/`@summary`/`@boundary` 等结构定义行，
    // 匹配成功后直接返回，不再走主题标记解析流程。
    if (this.appendMindStructureHighlightedLine(lineEl, sourceLine)) return;

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

  // 高亮处理结构定义块中的特殊行：块标记（`@structures`/`@end`）和结构声明（`@relation [...]` 等）。
  // 返回 true 表示该行已被结构高亮处理，调用方应跳过后续主题标记解析。
  appendMindStructureHighlightedLine(lineEl, sourceLine) {
    // 匹配 `@structures` 或 `@end` 块标记行：纯关键字，无属性。
    const blockMarkerMatch = sourceLine.match(/^(\s*)(@(structures|end))(\s*)$/);
    if (blockMarkerMatch) {
      lineEl.classList.add('is-structure-line');
      lineEl.appendChild(document.createTextNode(blockMarkerMatch[1]));
      this.appendSourceToken(
        lineEl,
        blockMarkerMatch[2],
        'yonxao-mindmap-source-token-structure-keyword'
      );
      lineEl.appendChild(document.createTextNode(blockMarkerMatch[4]));
      return true;
    }

    // 匹配结构声明行：`@relation [...]`、`@summary [...]`、`@boundary [...]`。
    // 结构语法 = 关键字 + 空格 + 方括号包裹的属性列表。
    const structureMatch = sourceLine.match(
      /^(\s*)(@(relation|summary|boundary))(\s+)(\[)(.*)(\])(\s*)$/
    );
    if (!structureMatch) return false;

    lineEl.classList.add('is-structure-line');
    lineEl.appendChild(document.createTextNode(structureMatch[1]));
    this.appendSourceToken(
      lineEl,
      structureMatch[2],
      'yonxao-mindmap-source-token-structure-keyword'
    );
    lineEl.appendChild(document.createTextNode(structureMatch[4]));
    this.appendSourceToken(
      lineEl,
      structureMatch[5],
      'yonxao-mindmap-source-token-structure-punctuation'
    );
    this.appendMindStructureAttributes(lineEl, structureMatch[6]);
    this.appendSourceToken(
      lineEl,
      structureMatch[7],
      'yonxao-mindmap-source-token-structure-punctuation'
    );
    lineEl.appendChild(document.createTextNode(structureMatch[8]));
    return true;
  },

  // 解析结构声明中 `[...]` 内的属性列表，按属性名/等号/值三段分别染色。
  // 其中 id 属性的值使用特殊颜色，与其他属性值区分开以突出稳定 ID 的重要性。
  appendMindStructureAttributes(lineEl, source) {
    const attributePattern = /([a-zA-Z][\w-]*)(=)("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s]+)/g;
    let sourceIndex = 0;
    let match;
    while ((match = attributePattern.exec(source))) {
      lineEl.appendChild(document.createTextNode(source.slice(sourceIndex, match.index)));
      this.appendSourceToken(lineEl, match[1], 'yonxao-mindmap-source-token-structure-attribute');
      this.appendSourceToken(lineEl, match[2], 'yonxao-mindmap-source-token-structure-punctuation');
      this.appendSourceToken(
        lineEl,
        match[3],
        match[1] === 'id'
          ? 'yonxao-mindmap-source-token-structure-id'
          : 'yonxao-mindmap-source-token-structure-value'
      );
      sourceIndex = attributePattern.lastIndex;
    }
    lineEl.appendChild(document.createTextNode(source.slice(sourceIndex)));
  },

  appendSourceToken(parentEl, text, className) {
    appendSourceToken(parentEl, text, className);
  },

  sourceInputCursorLineIndex() {
    return sourceInputCursorLineIndex(this.sourceInputEl);
  },
};
