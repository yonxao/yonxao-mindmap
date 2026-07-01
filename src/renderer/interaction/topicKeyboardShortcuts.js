/*
 * 文件作用：
 * 导图键盘快捷键方法集合，负责导图 SVG 收到 keydown 后的快捷键匹配和命令分发。
 *
 * 实现逻辑：
 * 本文件只处理“按键 -> 命令”的分发；主题树修改仍复用 model/topicCommands.js。
 *
 * 调用链：
 * SVG keydown -> topicKeyboardShortcutMethods -> topicInteractionMethods/topicCommandMethods。
 */

import { ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR } from '../../constants.js';
import { Notice } from '../../shared/rendererShared.js';

const MAP_NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const MAP_CONTROL_SHORTCUTS = Object.freeze([
  Object.freeze({
    command: 'openConfigModal',
    key: ',',
    code: 'Comma',
    altKey: true,
    shiftKey: false,
  }),
]);

const VIEW_CONTROL_SHORTCUTS = Object.freeze([
  Object.freeze({
    command: 'zoomIn',
    key: '+',
    code: 'Equal',
    altKey: true,
    allowShiftKey: true,
  }),
  Object.freeze({
    command: 'zoomOut',
    key: '-',
    code: 'Minus',
    altKey: true,
    shiftKey: false,
  }),
  Object.freeze({
    command: 'fitView',
    key: '0',
    code: 'Digit0',
    altKey: true,
    shiftKey: false,
  }),
  Object.freeze({
    command: 'showOriginalSizeView',
    key: '1',
    code: 'Digit1',
    altKey: true,
    shiftKey: false,
  }),
  Object.freeze({
    command: 'toggleWindowFullscreen',
    key: '2',
    code: 'Digit2',
    altKey: true,
    shiftKey: false,
  }),
  Object.freeze({
    command: 'toggleFullscreen',
    key: '3',
    code: 'Digit3',
    altKey: true,
    shiftKey: false,
  }),
]);

const TOPIC_COMMAND_SHORTCUTS = Object.freeze([
  Object.freeze({
    command: 'addSubtopic',
    key: 'Tab',
    shiftKey: false,
  }),
  Object.freeze({
    command: 'addSiblingAfter',
    key: 'Enter',
    shiftKey: false,
  }),
  Object.freeze({
    command: 'addSiblingBefore',
    key: 'Enter',
    shiftKey: true,
  }),
  Object.freeze({
    command: 'deleteTopic',
    key: 'Delete',
    shiftKey: false,
  }),
  Object.freeze({
    command: 'deleteTopic',
    key: 'Backspace',
    metaKey: true,
    shiftKey: false,
  }),
  Object.freeze({
    command: 'openTopicEditor',
    key: '`',
    shiftKey: false,
  }),
  Object.freeze({
    command: 'openInlineTextEditor',
    key: ' ',
    shiftKey: false,
  }),
  Object.freeze({
    command: 'openInlineTextEditor',
    key: 'Spacebar',
    shiftKey: false,
  }),
  Object.freeze({
    command: 'toggleTopicCollapse',
    key: '/',
    code: 'Slash',
    altKey: true,
    shiftKey: false,
    editRequired: false,
  }),
  Object.freeze({
    command: 'copyTopicContent',
    key: 'c',
    code: 'KeyC',
    modifier: 'primary',
    shiftKey: false,
  }),
  Object.freeze({
    command: 'cutTopicContent',
    key: 'x',
    code: 'KeyX',
    modifier: 'primary',
    shiftKey: false,
  }),
  Object.freeze({
    command: 'pasteTopicContent',
    key: 'v',
    code: 'KeyV',
    modifier: 'primary',
    shiftKey: false,
  }),
  Object.freeze({
    command: 'copyTopicWithAttributes',
    key: 'c',
    code: 'KeyC',
    modifier: 'primary',
    altKey: true,
    shiftKey: false,
  }),
  Object.freeze({
    command: 'pasteTopicWithAttributes',
    key: 'v',
    code: 'KeyV',
    modifier: 'primary',
    altKey: true,
    shiftKey: false,
  }),
  Object.freeze({
    command: 'undoTopicChange',
    key: 'z',
    code: 'KeyZ',
    modifier: 'primary',
    shiftKey: false,
  }),
  Object.freeze({
    command: 'redoTopicChange',
    key: 'y',
    code: 'KeyY',
    modifier: 'primary',
    shiftKey: false,
  }),
  Object.freeze({
    command: 'redoTopicChange',
    key: 'z',
    code: 'KeyZ',
    modifier: 'primary',
    shiftKey: true,
  }),
]);

function matchesShortcutKey(event, shortcut) {
  if (shortcut.code && event.code === shortcut.code) return true;
  return event.key === shortcut.key;
}

function matchesTopicCommandShortcut(event, shortcut) {
  const requiresPrimaryModifier = shortcut.modifier === 'primary';
  const matchesPrimaryModifier = requiresPrimaryModifier
    ? event.metaKey !== event.ctrlKey
    : Boolean(event.metaKey) === Boolean(shortcut.metaKey) &&
      Boolean(event.ctrlKey) === Boolean(shortcut.ctrlKey);

  return (
    matchesShortcutKey(event, shortcut) &&
    matchesPrimaryModifier &&
    Boolean(event.shiftKey) === shortcut.shiftKey &&
    Boolean(event.altKey) === Boolean(shortcut.altKey)
  );
}

function matchesViewControlShortcut(event, shortcut) {
  return (
    matchesShortcutKey(event, shortcut) &&
    Boolean(event.altKey) === Boolean(shortcut.altKey) &&
    !event.ctrlKey &&
    !event.metaKey &&
    (shortcut.allowShiftKey || Boolean(event.shiftKey) === Boolean(shortcut.shiftKey))
  );
}

export const topicKeyboardShortcutMethods = {
  handleMapKeyDown(event) {
    if (this.isSourceMode) return;
    if (event.target !== this.svgEl || event.isComposing) return;

    const mapControlShortcut = MAP_CONTROL_SHORTCUTS.find((shortcut) =>
      matchesViewControlShortcut(event, shortcut)
    );
    if (mapControlShortcut) {
      this.handleMapControlShortcut(event, mapControlShortcut);
      return;
    }

    const viewControlShortcut = VIEW_CONTROL_SHORTCUTS.find((shortcut) =>
      matchesViewControlShortcut(event, shortcut)
    );
    if (viewControlShortcut) {
      this.handleViewControlShortcut(event, viewControlShortcut);
      return;
    }

    const currentTopic = this.ensureFocusedTopic();
    if (!currentTopic) return;

    const commandShortcut = TOPIC_COMMAND_SHORTCUTS.find((shortcut) =>
      matchesTopicCommandShortcut(event, shortcut)
    );
    if (commandShortcut) {
      this.handleTopicCommandShortcut(event, currentTopic, commandShortcut);
      return;
    }

    this.handleTopicNavigationShortcut(event, currentTopic);
  },

  handleTopicNavigationShortcut(event, currentTopic) {
    // 方向键只处理裸按键；组合键留给 Obsidian、浏览器或后续更高阶快捷键。
    if (
      !MAP_NAVIGATION_KEYS.has(event.key) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const nextTopic = this.findKeyboardNavigationTopic(currentTopic, event.key);
    if (nextTopic) {
      this.setFocusedTopic(nextTopic.id, { focusSvg: false, ensureInView: true });
    }
  },

  handleMapControlShortcut(event, shortcut) {
    event.preventDefault();
    event.stopPropagation();

    Promise.resolve(this.executeMapControlShortcut(shortcut.command)).catch((error) => {
      new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
    });
  },

  async executeMapControlShortcut(command) {
    switch (command) {
      case 'openConfigModal':
        await this.openConfigModal();
        return true;
      default:
        return false;
    }
  },

  handleViewControlShortcut(event, shortcut) {
    event.preventDefault();
    event.stopPropagation();

    Promise.resolve(this.executeViewControlShortcut(shortcut.command)).catch((error) => {
      new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
    });
  },

  async executeViewControlShortcut(command) {
    switch (command) {
      case 'zoomIn':
        this.zoomAtCenter(ZOOM_IN_FACTOR);
        return true;
      case 'zoomOut':
        this.zoomAtCenter(ZOOM_OUT_FACTOR);
        return true;
      case 'fitView':
        this.fitView();
        return true;
      case 'showOriginalSizeView':
        this.showOriginalSizeView();
        return true;
      case 'toggleWindowFullscreen':
        this.toggleWindowFullscreen();
        return true;
      case 'toggleFullscreen':
        await this.toggleFullscreen();
        return true;
      default:
        return false;
    }
  },

  handleTopicCommandShortcut(event, currentTopic, shortcut) {
    if (shortcut.editRequired !== false && !this.canEditMindMap()) return;

    // 主题快捷键可能和 Obsidian 或浏览器原生快捷键冲突；确认命中后必须拦截外层处理。
    event.preventDefault();
    event.stopPropagation();

    Promise.resolve(this.executeTopicShortcutCommand(currentTopic, shortcut.command)).catch(
      (error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      }
    );
  },

  async executeTopicShortcutCommand(currentTopic, command) {
    switch (command) {
      case 'addSubtopic': {
        const result = await this.addSubtopicFromContextMenu(currentTopic);
        this.focusCreatedTopicFromShortcut(result);
        return result;
      }
      case 'addSiblingBefore': {
        const result = await this.addSiblingFromContextMenu(currentTopic, 'before');
        this.focusCreatedTopicFromShortcut(result);
        return result;
      }
      case 'addSiblingAfter': {
        const result = await this.addSiblingFromContextMenu(currentTopic, 'after');
        this.focusCreatedTopicFromShortcut(result);
        return result;
      }
      case 'deleteTopic':
        return this.deleteTopicFromShortcut(currentTopic);
      case 'openTopicEditor':
        this.openTopicEditorFromShortcut(currentTopic);
        return true;
      case 'openInlineTextEditor':
        this.openInlineTextEditorFromShortcut(currentTopic);
        return true;
      case 'toggleTopicCollapse':
        this.toggleTopicCollapseFromShortcut(currentTopic);
        return true;
      case 'copyTopicContent':
        return this.copyTopicContentForShortcut(currentTopic);
      case 'cutTopicContent':
        return this.cutTopicContentForShortcut(currentTopic);
      case 'pasteTopicContent': {
        const result = await this.pasteTopicContentForShortcut(currentTopic);
        this.focusCreatedTopicFromShortcut(result);
        return result;
      }
      case 'copyTopicWithAttributes':
        return this.copyTopicWithAttributesForShortcut(currentTopic);
      case 'pasteTopicWithAttributes': {
        const result = await this.pasteTopicWithAttributesForShortcut(currentTopic);
        this.focusCreatedTopicFromShortcut(result);
        return result;
      }
      case 'undoTopicChange':
        return this.undoTopicChange();
      case 'redoTopicChange':
        return this.redoTopicChange();
      default:
        return false;
    }
  },

  async deleteTopicFromShortcut(currentTopic) {
    const parentTopic = this.findTopicParentInTree(currentTopic?.id);
    if (parentTopic?.id) {
      this.rememberTopicFocusState(parentTopic.id, { focusSvg: true });
    }
    const deleted = await this.deleteTopicFromContextMenu(currentTopic);
    if (!deleted) return false;

    if (!this.setFocusedTopic(parentTopic?.id, { focusSvg: true, ensureInView: true })) {
      this.ensureFocusedTopic();
    }
    return true;
  },

  openTopicEditorFromShortcut(currentTopic) {
    this.setFocusedTopic(currentTopic.id, { focusSvg: false, ensureInView: true });
    this.openTopicEditor(currentTopic);
  },

  openInlineTextEditorFromShortcut(currentTopic) {
    this.setFocusedTopic(currentTopic.id, { focusSvg: false, ensureInView: true });
    this.openInlineTextEditor(currentTopic);
  },

  toggleTopicCollapseFromShortcut(currentTopic) {
    if (!currentTopic?.subtopics?.length) return false;

    this.toggleTopicCollapse(currentTopic);
    this.setFocusedTopic(currentTopic.id, { focusSvg: true, ensureInView: true });
    return true;
  },

  focusCreatedTopicFromShortcut(result) {
    if (!result || !result.saved || !result.topicId) return;

    /*
     * 新增主题保存后会触发 renderMap()，因此 topicById 已经刷新。
     * 这里只把焦点移到新主题，不自动打开编辑框，避免创建动作强制进入文本编辑状态。
     */
    this.setFocusedTopic(result.topicId, { focusSvg: true, ensureInView: true });
  },
};
