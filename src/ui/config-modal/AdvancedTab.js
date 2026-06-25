/*
 * 文件作用：
 * 配置面板高级页方法集合，负责 YAML 文本编辑和语法状态反馈。
 *
 * 实现逻辑：
 * 高级页直接编辑 draftConfig 的 YAML 表示，解析成功后同步到结构化草稿。
 *
 * 调用链：
 * ConfigModal.render() -> advancedTabMethods -> configDraft/yamlConfig。
 */

import {
  parseDraftConfigText,
  stringifyDraftConfig,
  canonicalizeMindConfig,
  pruneInactiveMindConfig,
} from './configModalShared.js';
import {
  appendConfigHighlightedLine,
  createSourceCodeEditor,
  syncSourceCodeEditorScroll,
  updateSourceCodeEditor,
  updateSourceCodeEditorActiveLine,
} from '../source/sourceCodeEditor.js';

export const advancedTabMethods = {
  renderAdvancedTab() {
    this.createSection(this.t('configModal.advanced.section'));
    this.advancedInputEl = document.createElement('textarea');
    this.advancedInputEl.className =
      'yonxao-mindmap-source-input yonxao-mindmap-source-config-input is-active';
    this.advancedInputEl.spellcheck = false;
    this.advancedInputEl.wrap = 'off';
    this.advancedInputEl.value = stringifyDraftConfig(
      pruneInactiveMindConfig(this.draftConfig, this.baseConfig)
    );
    const advancedEditor = createSourceCodeEditor(this.advancedInputEl, {
      className: 'yonxao-mindmap-source-config-editor is-active',
    });
    const advancedEditorShellEl = document.createElement('div');
    // 高级页直接复用源码模式配置区的外壳，避免再维护一套 textarea 边框、焦点和字体度量样式。
    advancedEditorShellEl.className = 'yonxao-mindmap-source-editor';
    this.advancedEditorEl = advancedEditor.editorEl;
    this.advancedHighlightEl = advancedEditor.highlightEl;
    this.advancedLineNumbersEl = advancedEditor.lineNumbersEl;
    advancedEditorShellEl.appendChild(this.advancedEditorEl);
    this.formEl.appendChild(advancedEditorShellEl);
    this.updateAdvancedEditor();

    this.advancedInputEl.addEventListener('input', () => {
      try {
        this.draftConfig = canonicalizeMindConfig(parseDraftConfigText(this.advancedInputEl.value));
        this.updateStatus(this.t('configModal.status.valid'));
      } catch (error) {
        this.updateStatus(
          this.t('configModal.status.invalid', { message: error.message || String(error) }),
          true
        );
      }
      this.updateAdvancedEditor();
    });
    this.advancedInputEl.addEventListener('scroll', () => this.syncAdvancedEditorScroll());
    this.advancedInputEl.addEventListener('click', () => this.updateAdvancedEditorActiveLine());
    this.advancedInputEl.addEventListener('keyup', () => this.updateAdvancedEditorActiveLine());
    this.advancedInputEl.addEventListener('select', () => this.updateAdvancedEditorActiveLine());
  },

  updateAdvancedEditor() {
    updateSourceCodeEditor(
      this.advancedInputEl,
      this.advancedHighlightEl,
      this.advancedLineNumbersEl,
      {
        renderLine: appendConfigHighlightedLine,
      }
    );
  },

  updateAdvancedEditorActiveLine() {
    updateSourceCodeEditorActiveLine(
      this.advancedInputEl,
      this.advancedHighlightEl,
      this.advancedLineNumbersEl
    );
  },

  syncAdvancedEditorScroll() {
    syncSourceCodeEditorScroll(
      this.advancedInputEl,
      this.advancedHighlightEl,
      this.advancedLineNumbersEl
    );
  },
};
