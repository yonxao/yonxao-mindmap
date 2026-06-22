/*
 * 文件作用：
 * 配置弹框布局页方法集合，负责布局类型、连线线型、下挂展开和主题最大宽度。
 *
 * 实现逻辑：
 * 布局类型变化会影响连线和下挂展开是否可编辑，因此相关字段变更后立即重绘布局页。
 *
 * 调用链：
 * ConfigModal.render() -> layoutTabMethods -> configModalRules/configFields。
 */

import { setConfigValue, TOPIC_MAX_WIDTH_MAX, TOPIC_MAX_WIDTH_MIN } from './configModalShared.js';

export const layoutTabMethods = {
  renderLayoutTab(normalized) {
    this.createSection(this.t('configModal.layout.section'));
    const layoutSelect = this.createSelectField(
      this.t('configModal.layout.type'),
      ['layout', 'type'],
      normalized.layout,
      this.layoutOptionGroups()
    );
    layoutSelect.addEventListener('change', () => {
      // 布局类型会影响后续字段是否可编辑，因此切换布局后立刻重绘结构页，避免保留已经不适用的线型控件。
      this.render();
    });

    let connectorSelect = null;
    if (this.isConnectorStyleConfigurable(normalized.layout)) {
      connectorSelect = this.createSelectField(
        this.t('configModal.layout.connectorStyle'),
        ['layout', 'connectorStyle'],
        normalized.connector.style,
        this.connectorOptions()
      );
      connectorSelect.addEventListener('change', () => {
        this.render();
      });
    } else {
      this.createDisabledConnectorStyleField();
    }

    if (this.isBranchExpansionConfigurable(normalized.layout, normalized.connector.style)) {
      const branchExpansionSelect = this.createSelectField(
        this.t('configModal.layout.branchExpansion'),
        ['layout', 'branchExpansion'],
        normalized.branch.expansion,
        this.branchExpansionOptions()
      );
      branchExpansionSelect.addEventListener('change', () => {
        setConfigValue(this.draftConfig, ['layout', 'type'], normalized.layout);
        this.syncInheritedValueStyle(layoutSelect._yonxaoMindmapControlEl, ['layout', 'type']);
        if (!this.isConnectorStyleConfigurable(normalized.layout)) return;
        setConfigValue(this.draftConfig, ['layout', 'connectorStyle'], 'elbow');
        this.syncInheritedValueStyle(connectorSelect._yonxaoMindmapControlEl, [
          'layout',
          'connectorStyle',
        ]);
      });
    }

    this.createTopicMaxWidthGroup(normalized);
  },

  createTopicMaxWidthGroup(normalized) {
    this.createSection(this.t('configModal.layout.topicMaxWidthSection'));
    const inputOptions = {
      min: TOPIC_MAX_WIDTH_MIN,
      max: TOPIC_MAX_WIDTH_MAX,
      step: 10,
    };

    const globalMaxWidth = normalized.topic.maxWidth;

    this.createNumberField(
      this.t('configModal.layout.topicMaxWidthGlobal'),
      ['layout', 'topicMaxWidth', 'global'],
      globalMaxWidth,
      {
        ...inputOptions,
        help: this.t('configModal.layout.topicMaxWidth.help'),
      }
    );

    for (const level of ['1', '2', '3']) {
      const levelKey = `level${level}`;
      const levelTopic = normalized.topic.levels[level] || {};
      this.createNumberField(
        this.t(`configModal.layout.topicMaxWidthLevel${level}`),
        ['layout', 'topicMaxWidth', levelKey],
        levelTopic.maxWidth || globalMaxWidth,
        {
          ...inputOptions,
        }
      );
    }
  },
};
