/*
 * 文件作用：
 * 配置面板结构页方法集合，负责布局类型、连线线型、下挂展开和主题最大宽度。
 */

import { TOPIC_MAX_WIDTH_MAX, TOPIC_MAX_WIDTH_MIN } from './configModalShared.js';

export const structureTabMethods = {
  renderStructureTab(normalized) {
    this.createSection(this.t('configModal.structure.layoutSection'));
    const layoutSelect = this.createSelectField(
      this.t('configModal.structure.layout'),
      ['structure', 'layout'],
      normalized.layout,
      this.layoutOptionGroups()
    );
    layoutSelect.addEventListener('change', () => {
      // 布局类型会影响后续字段是否可编辑，因此切换布局后立刻重绘结构页。
      this.render();
    });

    let connectorSelect = null;
    this.createSection(this.t('configModal.structure.connectorSection'));
    if (this.isConnectorStyleConfigurable(normalized.layout)) {
      connectorSelect = this.createSelectField(
        this.t('configModal.structure.connectorStyle'),
        ['structure', 'connectorStyle'],
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
        this.t('configModal.structure.branchExpansion'),
        ['structure', 'branchExpansion'],
        normalized.branch.expansion,
        this.branchExpansionOptions(),
        {
          help: this.t('configModal.structure.branchExpansion.elbowOnlyHelp'),
        }
      );
      branchExpansionSelect.addEventListener('change', () => {
        this.setConfigValueOrDeleteInherited(
          ['structure', 'layout'],
          normalized.layout,
          layoutSelect._yonxaoMindmapInheritedValue
        );
        this.syncInheritedValueStyle(layoutSelect._yonxaoMindmapControlEl, ['structure', 'layout']);
        if (!this.isConnectorStyleConfigurable(normalized.layout)) return;
        this.setConfigValueOrDeleteInherited(
          ['structure', 'connectorStyle'],
          'elbow',
          connectorSelect._yonxaoMindmapInheritedValue
        );
        this.syncInheritedValueStyle(connectorSelect._yonxaoMindmapControlEl, [
          'structure',
          'connectorStyle',
        ]);
      });
    }

    this.createTopicMaxWidthGroup(normalized);
  },

  createTopicMaxWidthGroup(normalized) {
    this.createSection(this.t('configModal.structure.topicMaxWidthSection'));
    const inputOptions = {
      min: TOPIC_MAX_WIDTH_MIN,
      max: TOPIC_MAX_WIDTH_MAX,
      step: 10,
    };

    const globalMaxWidth = normalized.topic.maxWidth;

    this.createNumberField(
      this.t('configModal.structure.topicMaxWidthGlobal'),
      ['structure', 'topicMaxWidth', 'global'],
      globalMaxWidth,
      {
        ...inputOptions,
        help: this.t('configModal.structure.topicMaxWidth.help'),
      }
    );

    for (const level of ['1', '2', '3']) {
      const levelKey = `level${level}`;
      const levelTopic = normalized.topic.levels[level] || {};
      this.createNumberField(
        this.t(`configModal.structure.topicMaxWidthLevel${level}`),
        ['structure', 'topicMaxWidth', levelKey],
        levelTopic.maxWidth || globalMaxWidth,
        {
          ...inputOptions,
        }
      );
    }
  },
};
