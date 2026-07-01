/*
 * 快捷键页仅展示当前固定快捷键，不写入配置，也不提供自定义入口。
 */

function shortcutGroup(titleKey, rows) {
  return Object.freeze({
    titleKey: `configModal.shortcuts.${titleKey}`,
    rows: Object.freeze(rows),
  });
}

function shortcutRow(actionKey, windows, mac) {
  return Object.freeze({
    actionKey: `configModal.shortcuts.action.${actionKey}`,
    windows: Object.freeze(windows),
    mac: Object.freeze(mac),
    descriptionKey: `configModal.shortcuts.description.${actionKey}`,
  });
}

const SHORTCUT_GROUPS = Object.freeze([
  shortcutGroup('topicCreateDeleteSection', [
    shortcutRow('addSubtopic', ['Tab'], ['Tab']),
    shortcutRow('addSiblingAfter', ['Enter'], ['Return']),
    shortcutRow('addSiblingBefore', ['Shift+Enter'], ['Shift+Return']),
    shortcutRow('deleteTopic', ['Delete'], ['Delete', 'Cmd+Backspace']),
  ]),
  shortcutGroup('topicEditSection', [
    shortcutRow('openTopicEditor', ['`'], ['`']),
    shortcutRow('openInlineEditor', ['Space'], ['Space']),
    shortcutRow('inlineNewline', ['Shift+Enter'], ['Shift+Return']),
    shortcutRow('inlineSubmit', ['Enter'], ['Return']),
    shortcutRow('inlineCancel', ['Esc'], ['Esc']),
    shortcutRow('topicEditorSave', ['Ctrl+S'], ['Cmd+S']),
    shortcutRow('contentEditorSave', ['Ctrl+S'], ['Cmd+S']),
  ]),
  shortcutGroup('topicNavigateCollapseSection', [
    shortcutRow('navigateTopic', ['↑', '↓', '←', '→'], ['↑', '↓', '←', '→']),
    shortcutRow('toggleCollapse', ['Alt+/'], ['Option+/']),
  ]),
  shortcutGroup('topicClipboardHistorySection', [
    shortcutRow('copyTopicContent', ['Ctrl+C'], ['Cmd+C']),
    shortcutRow('cutTopicContent', ['Ctrl+X'], ['Cmd+X']),
    shortcutRow('pasteTopicContent', ['Ctrl+V'], ['Cmd+V']),
    shortcutRow('copyTopicWithAttributes', ['Ctrl+Alt+C'], ['Cmd+Option+C']),
    shortcutRow('pasteTopicWithAttributes', ['Ctrl+Alt+V'], ['Cmd+Option+V']),
    shortcutRow('undoTopicChange', ['Ctrl+Z'], ['Cmd+Z']),
    shortcutRow('redoTopicChange', ['Ctrl+Y'], ['Cmd+Shift+Z']),
  ]),
  shortcutGroup('viewControlSection', [
    shortcutRow('zoomIn', ['Alt++'], ['Option++']),
    shortcutRow('zoomOut', ['Alt+-'], ['Option+-']),
    shortcutRow('fitView', ['Alt+0'], ['Option+0']),
    shortcutRow('originalSize', ['Alt+1'], ['Option+1']),
    shortcutRow('windowFullscreen', ['Alt+2'], ['Option+2']),
    shortcutRow('fullscreen', ['Alt+3'], ['Option+3']),
  ]),
  shortcutGroup('mapControlSection', [shortcutRow('openConfigModal', ['Alt+,'], ['Option+,'])]),
]);

export const shortcutsTabMethods = {
  renderShortcutsTab() {
    const wrapperEl = this.formEl.createDiv({ cls: 'yonxao-mindmap-shortcuts-tab' });
    wrapperEl.createDiv({
      cls: 'yonxao-mindmap-config-help',
      text: this.t('configModal.shortcuts.help'),
    });

    for (const group of SHORTCUT_GROUPS) {
      this.renderShortcutGroup(wrapperEl, group);
    }
  },

  renderShortcutGroup(wrapperEl, group) {
    const groupEl = wrapperEl.createDiv({ cls: 'yonxao-mindmap-shortcuts-group' });
    groupEl.createDiv({
      cls: 'yonxao-mindmap-config-section yonxao-mindmap-shortcuts-section',
      text: this.t(group.titleKey),
    });

    const listEl = groupEl.createDiv({
      cls: 'yonxao-mindmap-shortcuts-list',
      attr: { role: 'table' },
    });
    this.renderShortcutHeader(listEl);

    for (const row of group.rows) {
      this.renderShortcutRow(listEl, row);
    }
  },

  renderShortcutHeader(listEl) {
    const headerEl = listEl.createDiv({
      cls: 'yonxao-mindmap-shortcuts-row yonxao-mindmap-shortcuts-header',
      attr: { role: 'row' },
    });

    for (const key of [
      'configModal.shortcuts.header.action',
      'configModal.shortcuts.header.windows',
      'configModal.shortcuts.header.mac',
      'configModal.shortcuts.header.description',
    ]) {
      headerEl.createDiv({
        cls: 'yonxao-mindmap-shortcuts-cell',
        text: this.t(key),
        attr: { role: 'columnheader' },
      });
    }
  },

  renderShortcutRow(listEl, row) {
    const rowEl = listEl.createDiv({
      cls: 'yonxao-mindmap-shortcuts-row',
      attr: { role: 'row' },
    });

    rowEl.createDiv({
      cls: 'yonxao-mindmap-shortcuts-cell yonxao-mindmap-shortcuts-action',
      text: this.t(row.actionKey),
      attr: { role: 'cell' },
    });
    this.renderShortcutKeyCell(rowEl, row.windows, 'windows');
    this.renderShortcutKeyCell(rowEl, row.mac, 'mac');
    rowEl.createDiv({
      cls: 'yonxao-mindmap-shortcuts-cell yonxao-mindmap-shortcuts-description',
      text: this.t(row.descriptionKey),
      attr: {
        role: 'cell',
        'data-label': this.t('configModal.shortcuts.header.description'),
      },
    });
  },

  renderShortcutKeyCell(rowEl, value, platform) {
    const cellEl = rowEl.createDiv({
      cls: 'yonxao-mindmap-shortcuts-cell yonxao-mindmap-shortcuts-key-cell',
      attr: {
        role: 'cell',
        'data-label': this.t(`configModal.shortcuts.header.${platform}`),
      },
    });

    for (const keyText of value) {
      cellEl.createEl('kbd', {
        cls: 'yonxao-mindmap-shortcuts-key',
        text: keyText,
      });
    }
  },
};
