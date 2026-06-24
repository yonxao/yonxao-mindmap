/*
 * 文件作用：
 * 配置面板交互页方法集合，负责工具栏、主题按钮和鼠标键盘行为。
 */

export const interactionTabMethods = {
  renderInteractionTab(normalized) {
    this.createSection(this.t('configModal.interaction.toolbarSection'));
    this.createSelectField(
      this.t('configModal.interaction.toolbarCorner'),
      ['interaction', 'toolbar', 'corner'],
      normalized.toolbar.corner,
      this.toolbarCornerOptions()
    );
    this.createSelectField(
      this.t('configModal.interaction.toolbarPlacement'),
      ['interaction', 'toolbar', 'placement'],
      normalized.toolbar.placement,
      this.toolbarPlacementOptions()
    );

    this.createSection(this.t('configModal.interaction.topicButtonSection'));
    this.createSelectField(
      this.t('configModal.interaction.topicControlVisibility'),
      ['interaction', 'topicControlVisibility'],
      normalized.button.topicControlVisibility,
      this.topicControlVisibilityOptions(),
      {
        help: this.t('configModal.interaction.topicControlVisibility.help'),
      }
    );

    this.createSection(this.t('configModal.interaction.inputSection'));
    this.createToggleField(
      this.t('configModal.interaction.wheelZoom'),
      ['interaction', 'wheelZoom'],
      normalized.interaction.wheelZoom,
      {
        help: this.t('configModal.interaction.wheelZoom.help'),
      }
    );
    this.createToggleField(
      this.t('configModal.interaction.tabIndent'),
      ['interaction', 'tabIndent'],
      normalized.source.enableTabIndent,
      {
        help: this.t('configModal.interaction.tabIndent.help'),
      }
    );
  },
};
