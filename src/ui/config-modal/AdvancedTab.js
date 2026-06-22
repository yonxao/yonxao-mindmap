/*
 * 文件作用：
 * 配置弹框高级页方法集合，负责 YAML 文本编辑和语法状态反馈。
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
      'yonxao-mindmap-source-input yonxao-mindmap-config-yaml is-active';
    this.advancedInputEl.spellcheck = false;
    this.advancedInputEl.wrap = 'off';
    this.advancedInputEl.value = stringifyDraftConfig(this.draftConfig);
    const advancedEditor = createSourceCodeEditor(this.advancedInputEl, {
      className: 'yonxao-mindmap-config-yaml-editor is-active',
    });
    this.advancedEditorEl = advancedEditor.editorEl;
    this.advancedHighlightEl = advancedEditor.highlightEl;
    this.advancedLineNumbersEl = advancedEditor.lineNumbersEl;
    this.formEl.appendChild(this.advancedEditorEl);
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
