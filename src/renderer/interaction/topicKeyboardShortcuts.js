/*
 * 文件作用：
 * 主题键盘快捷键方法集合，负责导图 SVG 获得焦点后的快捷键匹配和命令分发。
 *
 * 实现逻辑：
 * 本文件只处理“按键 -> 主题命令”的分发；真正的主题树修改仍复用 model/topicCommands.js。
 *
 * 调用链：
 * SVG keydown -> topicKeyboardShortcutMethods -> topicInteractionMethods/topicCommandMethods。
 */

import { Notice } from '../../shared/rendererShared.js';

const MAP_NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

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
]);

function matchesTopicCommandShortcut(event, shortcut) {
  return (
    event.key === shortcut.key &&
    Boolean(event.metaKey) === Boolean(shortcut.metaKey) &&
    Boolean(event.shiftKey) === shortcut.shiftKey &&
    !event.altKey &&
    !event.ctrlKey
  );
}

export const topicKeyboardShortcutMethods = {
  handleMapKeyDown(event) {
    if (this.isSourceMode) return;
    if (event.target !== this.svgEl || event.isComposing) return;

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

  handleTopicCommandShortcut(event, currentTopic, shortcut) {
    if (!this.canEditMindMap()) return;

    // Tab/Enter/Space/Delete 在 Obsidian 或浏览器里都有原生语义；确认是主题快捷键后必须拦截外层处理。
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

  focusCreatedTopicFromShortcut(result) {
    if (!result || !result.saved || !result.topicId) return;

    /*
     * 新增主题保存后会触发 renderMap()，因此 topicById 已经刷新。
     * 这里只把焦点移到新主题，不自动打开编辑框，避免创建动作强制进入文本编辑状态。
     */
    this.setFocusedTopic(result.topicId, { focusSvg: true, ensureInView: true });
  },
};
