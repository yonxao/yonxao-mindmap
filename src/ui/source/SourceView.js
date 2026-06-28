/*
 * 文件作用：
 * 源码视图外壳方法集合，负责配置/正文 Tab、输入区域和事件协调。
 *
 * 实现逻辑：
 * 源码模式拆分配置区和正文区，编辑后可保存回当前 yxmm 代码块。
 *
 * 调用链：
 * 工具栏切换 -> sourceViewMethods -> sourceDocument/sourceHighlight/sourceStatus。
 */

import {
  Notice,
  canonicalizeMindConfig,
  parseMindDocument,
  applyTopicLevelKey,
} from '../../shared/rendererShared.js';
import { createSourceCodeEditor } from './sourceCodeEditor.js';

export const sourceViewMethods = {
  createSourceView() {
    this.sourceEl = document.createElement('div');
    this.sourceEl.className = 'yonxao-mindmap-source';

    const tabListEl = document.createElement('div');
    tabListEl.className = 'yonxao-mindmap-source-tabs';
    tabListEl.setAttribute('role', 'tablist');

    this.sourceTabButtons = {
      config: this.createSourceTabButton('config', this.t('source.tab.config')),
      body: this.createSourceTabButton('body', this.t('source.tab.body')),
    };
    tabListEl.appendChild(this.sourceTabButtons.config);
    tabListEl.appendChild(this.sourceTabButtons.body);

    const editorEl = document.createElement('div');
    editorEl.className = 'yonxao-mindmap-source-editor';

    this.sourceConfigInputEl = document.createElement('textarea');
    this.sourceConfigInputEl.className =
      'yonxao-mindmap-source-input yonxao-mindmap-source-config-input';
    this.sourceConfigInputEl.spellcheck = false;
    this.sourceConfigInputEl.wrap = 'off';
    this.sourceConfigInputEl.id = `${this.sourceViewIdPrefix}-config`;
    // 源码模式下不设置 tooltip（aria-label），用户通过 Tab 按钮文字即可区分
    // 移除时保留 role='tabpanel' 以供屏幕阅读器识别所属区域
    this.sourceConfigInputEl.setAttribute('role', 'tabpanel');

    this.sourceInputEl = document.createElement('textarea');
    this.sourceInputEl.className = 'yonxao-mindmap-source-input yonxao-mindmap-source-body-input';
    this.sourceInputEl.spellcheck = false;
    this.sourceInputEl.wrap = 'off';
    this.sourceInputEl.id = `${this.sourceViewIdPrefix}-body`;
    this.sourceInputEl.setAttribute('role', 'tabpanel');

    const sourceConfigEditor = createSourceCodeEditor(this.sourceConfigInputEl, {
      className: 'yonxao-mindmap-source-config-editor',
    });
    this.sourceConfigEditorEl = sourceConfigEditor.editorEl;
    this.sourceConfigHighlightEl = sourceConfigEditor.highlightEl;
    this.sourceConfigLineNumbersEl = sourceConfigEditor.lineNumbersEl;

    const sourceBodyEditor = createSourceCodeEditor(this.sourceInputEl, {
      className: 'yonxao-mindmap-source-body-editor',
    });
    this.sourceBodyEditorEl = sourceBodyEditor.editorEl;
    this.sourceBodyHighlightEl = sourceBodyEditor.highlightEl;
    this.sourceBodyLineNumbersEl = sourceBodyEditor.lineNumbersEl;

    this.syncSourceInput();
    this.sourceLineCount = this.sourceInputLineCount();

    this.sourceStatusEl = document.createElement('div');
    this.sourceStatusEl.className = 'yonxao-mindmap-source-status';
    this.sourceStatusEl.textContent = this.t('source.status.editable');

    editorEl.appendChild(this.sourceConfigEditorEl);
    editorEl.appendChild(this.sourceBodyEditorEl);
    this.sourceEl.appendChild(tabListEl);
    this.sourceEl.appendChild(editorEl);
    this.sourceEl.appendChild(this.sourceStatusEl);
    this.containerEl.appendChild(this.sourceEl);

    this.installSourceInputEvents(this.sourceConfigInputEl, 'config');
    this.installSourceInputEvents(this.sourceInputEl, 'body');
    this.setSourceActiveTab('body', { focus: false });
  },

  createSourceTabButton(tab, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yonxao-mindmap-source-tab';
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `${this.sourceViewIdPrefix}-${tab}`);
    this.registerDomEvent(button, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.setSourceActiveTab(tab, { focus: true });
    });
    return button;
  },

  installSourceInputEvents(inputEl, tab) {
    this.registerDomEvent(inputEl, 'input', () => {
      this.sourceDirty = this.composeSourceFromSourceInputs() !== this.source;
      this.updateSourceStatus();
      if (tab === 'body') this.updateSourceBodyEditor();
      if (tab === 'config') this.updateSourceConfigEditor();
      if (tab === this.sourceActiveTab) {
        this.scheduleSourceModeHeightIfLineCountChanged();
      }
    });

    this.registerDomEvent(inputEl, 'keydown', (event) => {
      if (tab === 'body' && event.key === 'Tab') {
        if (!this.config.source.enableTabIndent) return;
        event.preventDefault();
        applyTopicLevelKey(this.sourceInputEl, event.shiftKey);
        this.sourceDirty = this.composeSourceFromSourceInputs() !== this.source;
        this.updateSourceStatus();
        this.updateSourceBodyEditor();
        this.scheduleSourceModeHeightIfLineCountChanged();
        return;
      }

      // 在 textarea 中拦截 Ctrl/Cmd+S，和桌面应用常见保存体验保持一致。
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        Promise.resolve(this.saveFromSourceView()).catch((error) => {
          new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
        });
      }
    });

    const syncEditorScroll = () => {
      if (tab === 'body') this.syncSourceBodyEditorScroll();
      if (tab === 'config') this.syncSourceConfigEditorScroll();
    };
    const updateActiveLine = () => {
      if (tab === 'body') this.updateSourceBodyEditorActiveLine();
      if (tab === 'config') this.updateSourceConfigEditorActiveLine();
    };
    this.registerDomEvent(inputEl, 'scroll', syncEditorScroll);
    this.registerDomEvent(inputEl, 'click', updateActiveLine);
    this.registerDomEvent(inputEl, 'keyup', updateActiveLine);
    this.registerDomEvent(inputEl, 'select', updateActiveLine);
  },

  setSourceActiveTab(tab, options = {}) {
    const nextTab = tab === 'config' ? 'config' : 'body';
    this.sourceActiveTab = nextTab;

    for (const [key, button] of Object.entries(this.sourceTabButtons || {})) {
      const isActive = key === nextTab;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    }

    this.sourceConfigEditorEl?.classList.toggle('is-active', nextTab === 'config');
    this.sourceConfigInputEl?.classList.toggle('is-active', nextTab === 'config');
    this.sourceInputEl?.classList.toggle('is-active', nextTab === 'body');
    this.sourceBodyEditorEl?.classList.toggle('is-active', nextTab === 'body');
    this.sourceLineCount = this.sourceInputLineCount();
    this.updateSourceConfigEditor();
    this.updateSourceBodyEditor();
    this.scheduleSourceModeHeight();

    if (options.focus) {
      const inputEl = this.activeSourceInputEl();
      inputEl?.focus();
    }
  },

  activeSourceInputEl() {
    return this.sourceActiveTab === 'config' && this.sourceConfigInputEl
      ? this.sourceConfigInputEl
      : this.sourceInputEl;
  },

  async saveFromSourceView() {
    if (!this.sourceInputEl) return false;

    const nextSource = this.composeSourceFromSourceInputs();
    let nextDocument;

    // 保存源码前先解析一次。这样用户写错标题层级或属性时，文件不会被插件写成不可渲染状态。
    try {
      nextDocument = parseMindDocument(nextSource);
    } catch (error) {
      new Notice(`yonxao-mindmap: 源码解析失败：${error.message || String(error)}`);
      this.updateSourceStatus('源码解析失败，请修正后再保存。');
      return false;
    }

    if (!nextDocument.root) {
      new Notice('yonxao-mindmap: 源码为空，未保存。');
      this.updateSourceStatus('源码为空，未保存。');
      return false;
    }

    const saved = await this.saveSourceToMarkdownFile(nextSource);
    if (!saved) return false;

    this.source = nextSource;
    this.root = nextDocument.root;
    this.rawConfig = canonicalizeMindConfig(nextDocument.rawConfig || {});
    this.refreshNormalizedConfig();
    this.hasConfigBlock = nextDocument.hasConfig;
    this.rememberViewModeConfig();
    this.collapsedIds.clear();
    this.sourceDirty = false;
    this.applyRuntimeConfigToView();
    this.updateSourceStatus('源码已保存，并已重新渲染导图。');
    this.scheduleSourceModeHeight();
    this.renderMap(true);
    return true;
  },
};
