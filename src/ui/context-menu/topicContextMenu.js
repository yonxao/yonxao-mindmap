/*
 * 文件作用：
 * 主题右键菜单方法集合，负责主题编辑、复制子树、新增/删除和折叠操作。
 *
 * 实现逻辑：
 * 根据命中的 topic id 决定菜单内容，根主题和虚拟主题会屏蔽不适用操作。
 *
 * 调用链：
 * SVG topic contextmenu -> topicContextMenuMethods -> topicCommands/collapseState。
 */

import { Menu, Notice } from '../../shared/rendererShared.js';

export const topicContextMenuMethods = {
  handleTopicContextMenu(event) {
    const target = event.target;
    const id = this.topicIdFromTarget(target);
    if (!id) {
      event.preventDefault();
      event.stopPropagation();
      this.openMapContextMenu(event);
      return;
    }

    if (!this.canEditMindMap()) return;

    const topic = this.topicById.get(id);
    if (!topic || topic._virtual) return;

    event.preventDefault();
    event.stopPropagation();
    this.openTopicContextMenu(event, topic);
  },

  openTopicContextMenu(event, topic) {
    const menu = new Menu();
    const canHaveSiblingTopic = topic !== this.root;
    const hasSubtopics = topic.subtopics.length > 0;
    const isCollapsed = this.collapsedIds.has(topic.id);

    this.addTopicContextMenuItem(menu, this.t('contextMenu.renameTopic'), 'pencil', () =>
      this.openInlineTextEditor(topic)
    );
    this.addTopicContextMenuItem(
      menu,
      this.t('contextMenu.editTopicAttributes'),
      'sliders-horizontal',
      () => this.openTopicEditor(topic)
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyTopicText'), 'copy', () =>
      this.copyTopicText(topic)
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copySubtreeBody'), 'git-branch', () =>
      this.copyPlainSubtree(topic)
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyIndentedSubtree'), 'list-tree', () =>
      this.copyIndentedSubtree(topic)
    );
    menu.addSeparator();

    this.addTopicContextMenuItem(menu, this.t('contextMenu.addSubtopic'), 'plus', () =>
      this.addSubtopicFromContextMenu(topic)
    );
    if (canHaveSiblingTopic) {
      this.addTopicContextMenuItem(menu, this.t('contextMenu.addSiblingBefore'), 'arrow-up', () =>
        this.addSiblingFromContextMenu(topic, 'before')
      );
      this.addTopicContextMenuItem(menu, this.t('contextMenu.addSiblingAfter'), 'arrow-down', () =>
        this.addSiblingFromContextMenu(topic, 'after')
      );
    }

    if (hasSubtopics) {
      menu.addSeparator();
      this.addTopicContextMenuItem(
        menu,
        isCollapsed
          ? this.t('contextMenu.expandSubtopics')
          : this.t('contextMenu.collapseSubtopics'),
        'list-tree',
        () => this.toggleTopicCollapse(topic)
      );
      this.addTopicContextMenuItem(
        menu,
        this.t('contextMenu.expandAllSubtopics'),
        'chevrons-down',
        () => this.expandTopicDescendants(topic)
      );
      this.addTopicContextMenuItem(
        menu,
        this.t('contextMenu.collapseAllSubtopics'),
        'chevrons-up',
        () => this.collapseTopicDescendants(topic)
      );
    }

    if (canHaveSiblingTopic) {
      menu.addSeparator();
      this.addTopicContextMenuItem(menu, this.t('contextMenu.deleteTopic'), 'trash-2', () =>
        this.deleteTopicFromContextMenu(topic)
      );
    }

    menu.showAtMouseEvent(event);
  },

  addTopicContextMenuItem(menu, title, icon, onClick) {
    menu.addItem((item) => {
      item.setTitle(title);
      if (icon) item.setIcon(icon);
      item.onClick(() => {
        Promise.resolve(onClick()).catch((error) => {
          new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
        });
      });
    });
  },
};
