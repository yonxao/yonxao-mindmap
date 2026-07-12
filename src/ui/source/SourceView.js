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

// 使用 KeyboardEvent.code 兜底识别物理 S 键，避免 macOS Option+S 产生特殊字符后 key 不再是 "s"。
const SOURCE_SAVE_SHORTCUT_CODE = 'KeyS';
const SOURCE_SAVE_SHORTCUT_KEY = 's';

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
    this.sourceStatusEl.classList.add('is-synced');

    editorEl.appendChild(this.sourceConfigEditorEl);
    editorEl.appendChild(this.sourceBodyEditorEl);
    this.sourceEl.appendChild(tabListEl);
    this.sourceEl.appendChild(editorEl);
    this.sourceEl.appendChild(this.sourceStatusEl);
    this.containerEl.appendChild(this.sourceEl);

    this.installSourceInputEvents(this.sourceConfigInputEl, 'config');
    this.installSourceInputEvents(this.sourceInputEl, 'body');
    this.installSourceViewGlobalShortcut();
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

      this.handleSourceViewSaveShortcut(event);
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

  installSourceViewGlobalShortcut() {
    if (this.sourceViewGlobalShortcutInstalled || typeof window === 'undefined') return;

    /*
     * Obsidian/CodeMirror 也会监听键盘事件，而且它们可能在外层捕获阶段先处理保存类快捷键。
     * 所以源码模式保存不能只挂在 textarea 冒泡阶段，否则焦点稍微偏到高亮层、宿主层或外层编辑器，
     * Ctrl/Cmd+S 就可能表现为“没反应”。
     *
     * 这里挂 window capture，但通过 isSourceShortcutTarget() 限定事件必须来自当前源码视图，
     * 避免抢走 Obsidian 其它区域或其它 yxmm 代码块的快捷键。
     */
    const sourceShortcutListener = (event) => {
      this.handleSourceViewSaveShortcut(event);
    };
    window.addEventListener('keydown', sourceShortcutListener, true);
    this.register(() => {
      window.removeEventListener('keydown', sourceShortcutListener, true);
    });
    this.sourceViewGlobalShortcutInstalled = true;
  },

  handleSourceViewSaveShortcut(event) {
    if (!this.isSourceMode || !this.isSourceSaveShortcut(event)) return;
    if (!this.isSourceShortcutTarget(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    Promise.resolve(this.saveFromSourceView()).catch((error) => {
      new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
    });
  },

  isSourceSaveShortcut(event) {
    if (event.isComposing) return false;
    const key = String(event.key || '').toLowerCase();
    return (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      (event.code === SOURCE_SAVE_SHORTCUT_CODE || key === SOURCE_SAVE_SHORTCUT_KEY)
    );
  },

  isSourceShortcutTarget(target) {
    return Boolean(target && this.sourceEl && this.sourceEl.contains(target));
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

    /*
     * 先写源码模式记忆，再真正修改 Markdown 文件。
     * Obsidian 写回文件后可能立刻卸载旧 renderer 并创建新 renderer；如果等 vault.modify()
     * 返回之后才记忆，新实例可能已经按默认导图模式渲染了，用户就会看到“偶尔切回导图”。
     */
    this.rememberSourceModeAcrossSave(nextSource);
    const saved = await this.saveSourceToMarkdownFile(nextSource);
    if (!saved) {
      this.updateSourceStatus(this.t('source.status.saveFailed'), 'error');
      return false;
    }

    this.source = nextSource;
    this.root = nextDocument.root;
    // 保存源码时同步更新 structures，确保后续从源码模式切回导图时结构数据一致。
    this.structures = nextDocument.structures || [];
    this.rawConfig = canonicalizeMindConfig(nextDocument.rawConfig || {});
    this.refreshNormalizedConfig();
    this.hasConfigBlock = nextDocument.hasConfig;
    this.rememberViewModeConfig();
    this.collapsedIds.clear();
    this.sourceDirty = false;
    this.applyRuntimeConfigToView();
    /*
     * 保存成功后再写一次，并附带“已保存”状态。
     * 如果 sectionInfo 不可用，记忆 key 会退回到源码前缀；保存前后的源码前缀可能不同，
     * 因此 rememberSourceModeAcrossSave() 同时覆盖旧源码和新源码两种 key。
     */
    this.rememberSourceModeAcrossSave(nextSource, {
      type: 'saved',
      messageKey: 'source.status.saved',
    });
    this.updateSourceStatus(this.t('source.status.saved'), 'saved');
    this.scheduleSourceModeHeight();
    /*
     * Ctrl/Cmd+S 是源码模式内保存，不应把用户带回导图模式。
     * 只有当前实例已经不在源码模式时，才立即重绘 SVG；正常从源码模式切回导图时，
     * toggleSourceMode() 会按最新 root/config 重新渲染。
     */
    if (!this.isSourceMode) {
      this.renderMap(true);
    }
    return true;
  },
};
