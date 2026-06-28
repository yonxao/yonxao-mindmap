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
import {
  ICON_EDIT_TOPIC,
  ICON_TOPIC_EDIT_PANEL,
  ICON_COPY_CONTENT,
  ICON_COPY_SUBTREE,
  ICON_COPY_INDENTED,
  ICON_ADD_SUBTOPIC,
  ICON_ADD_SIBLING_BEFORE,
  ICON_ADD_SIBLING_AFTER,
  ICON_COLLAPSE_TOGGLE,
  ICON_EXPAND_ALL,
  ICON_COLLAPSE_ALL,
  ICON_DELETE_TOPIC,
} from '../../icons/iconNames.js';

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

  _closeCurrentContextMenu() {
    if (this.plugin._currentContextMenu) {
      this.plugin._currentContextMenu.close();
      this.plugin._currentContextMenu = null;
    }
  },

  /*
   * 作用：
   * 为菜单添加失焦自动关闭监听。DOM 菜单在 setUseNativeMenu(false) 后，
   * 可能与 SVG pointerdown/click 事件交互导致 Obsidian 内置失焦检测失效，
   * 因此叠加一层手动 document level 监听。
   *
   * 同时在此处统一注册 menu.onHide，清空插件级菜单引用。
   */
  _setupMenuAutoClose(menu) {
    let menuEl = null;

    // 菜单 showAtMouseEvent 后立即获取 DOM，确保 z-index 在首帧渲染前到位
    const elevateMenu = () => {
      if (menuEl && menuEl.isConnected) return;
      const all = document.querySelectorAll('.menu');
      const el = all.length > 0 ? all[all.length - 1] : null;
      if (el && el.isConnected) {
        menuEl = el;
        // 确保当前菜单位于工具栏（z-index: 1000）之上，只影响本实例
        menuEl.style.zIndex = '1001';
      }
    };
    requestAnimationFrame(elevateMenu);

    const onPointerDown = (e) => {
      // 兜底：rAF 未能获取到时在首次交互时再尝试
      if (!menuEl || !menuEl.isConnected) {
        elevateMenu();
        if (!menuEl) return;
      }
      if (menuEl.contains(e.target)) return;
      menu.close();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    menu.onHide(() => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      menuEl = null;
      if (this.plugin._currentContextMenu === menu) {
        this.plugin._currentContextMenu = null;
      }
    });
  },

  openTopicContextMenu(event, topic) {
    this._closeCurrentContextMenu();
    const menu = new Menu();
    menu.setUseNativeMenu(false);
    this.plugin._currentContextMenu = menu;
    this._setupMenuAutoClose(menu);
    const canHaveSiblingTopic = topic !== this.root;
    const hasSubtopics = topic.subtopics.length > 0;
    const isCollapsed = this.collapsedIds.has(topic.id);

    this.addTopicContextMenuItem(menu, this.t('contextMenu.editTopic'), ICON_EDIT_TOPIC, () =>
      this.openInlineTextEditor(topic)
    );
    this.addTopicContextMenuItem(
      menu,
      this.t('contextMenu.topicEditPanel'),
      ICON_TOPIC_EDIT_PANEL,
      () => this.openTopicEditor(topic)
    );
    this.addTopicContextMenuItem(
      menu,
      this.t('contextMenu.copyTopicContent'),
      ICON_COPY_CONTENT,
      () => this.copyTopicContent(topic)
    );
    this.addTopicContextMenuItem(
      menu,
      this.t('contextMenu.copySubtreeBody'),
      ICON_COPY_SUBTREE,
      () => this.copyPlainSubtree(topic)
    );
    this.addTopicContextMenuItem(
      menu,
      this.t('contextMenu.copyIndentedSubtree'),
      ICON_COPY_INDENTED,
      () => this.copyIndentedSubtree(topic)
    );
    menu.addSeparator();

    this.addTopicContextMenuItem(menu, this.t('contextMenu.addSubtopic'), ICON_ADD_SUBTOPIC, () =>
      this.addSubtopicFromContextMenu(topic)
    );
    if (canHaveSiblingTopic) {
      this.addTopicContextMenuItem(
        menu,
        this.t('contextMenu.addSiblingBefore'),
        ICON_ADD_SIBLING_BEFORE,
        () => this.addSiblingFromContextMenu(topic, 'before')
      );
      this.addTopicContextMenuItem(
        menu,
        this.t('contextMenu.addSiblingAfter'),
        ICON_ADD_SIBLING_AFTER,
        () => this.addSiblingFromContextMenu(topic, 'after')
      );
    }

    if (hasSubtopics) {
      menu.addSeparator();
      this.addTopicContextMenuItem(
        menu,
        isCollapsed
          ? this.t('contextMenu.expandSubtopics')
          : this.t('contextMenu.collapseSubtopics'),
        ICON_COLLAPSE_TOGGLE,
        () => this.toggleTopicCollapse(topic)
      );
      this.addTopicContextMenuItem(
        menu,
        this.t('contextMenu.expandAllSubtopics'),
        ICON_EXPAND_ALL,
        () => this.expandTopicDescendants(topic)
      );
      this.addTopicContextMenuItem(
        menu,
        this.t('contextMenu.collapseAllSubtopics'),
        ICON_COLLAPSE_ALL,
        () => this.collapseTopicDescendants(topic)
      );
    }

    if (canHaveSiblingTopic) {
      menu.addSeparator();
      this.addTopicContextMenuItem(menu, this.t('contextMenu.deleteTopic'), ICON_DELETE_TOPIC, () =>
        this.deleteTopicFromContextMenu(topic)
      );
    }

    menu.showAtMouseEvent(event);
  },

  addTopicContextMenuItem(menu, title, icon, onClick) {
    menu.addItem((item) => {
      item.setTitle(title);
      // setUseNativeMenu(false) 确保菜单使用 DOM 渲染，item.setIcon() 正常工作
      if (icon) item.setIcon(icon);
      item.onClick(() => {
        Promise.resolve(onClick()).catch((error) => {
          new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
        });
      });
    });
  },
};
