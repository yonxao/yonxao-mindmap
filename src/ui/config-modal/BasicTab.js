/*
 * 文件作用：
 * 配置弹框基础页方法集合，负责幕布高度、源码高度、工具栏位置和基础交互开关。
 *
 * 实现逻辑：
 * 根据当前 normalized 配置创建字段，并把用户输入写入 draftConfig 对应路径。
 *
 * 调用链：
 * ConfigModal.render() -> basicTabMethods -> configFields/configModalState。
 */

import {
  setConfigValue,
  CANVAS_MAX_HEIGHT,
  CANVAS_MIN_HEIGHT,
  FIT_VIEW_MAX_SCALE_MAX,
  FIT_VIEW_MAX_SCALE_MIN,
} from './configModalShared.js';

export const basicTabMethods = {
  renderBasicTab(normalized) {
    this.createSection(this.t('configModal.basic.section'));
    this.createNumberField(
      this.t('configModal.basic.canvasHeight'),
      ['basic', 'canvasHeight'],
      normalized.canvas.height,
      {
        min: CANVAS_MIN_HEIGHT,
        max: CANVAS_MAX_HEIGHT,
        step: 1,
        placeholder: this.t('configModal.basic.placeholder.auto'),
        help: this.t('configModal.basic.canvasHeight.help'),
      }
    );
    this.createNumberField(
      this.t('configModal.basic.sourceHeight'),
      ['basic', 'sourceHeight'],
      normalized.source.height,
      {
        min: CANVAS_MIN_HEIGHT,
        max: CANVAS_MAX_HEIGHT,
        step: 1,
        placeholder: this.t('configModal.basic.placeholder.auto'),
        help: this.t('configModal.basic.sourceHeight.help'),
      }
    );
    this.createSelectField(
      this.t('configModal.basic.topicControlVisibility'),
      ['basic', 'topicControlVisibility'],
      normalized.button.topicControlVisibility,
      this.topicControlVisibilityOptions(),
      {
        help: this.t('configModal.basic.topicControlVisibility.help'),
      }
    );
    const viewFitSelect = this.createSelectField(
      this.t('configModal.basic.viewFit'),
      ['basic', 'viewFit'],
      normalized.view.fit,
      this.viewFitOptions(),
      {
        help: this.t('configModal.basic.viewFit.help'),
      }
    );
    const fitNoUpscaleToggle = this.createToggleField(
      this.t('configModal.basic.fitViewNoUpscale'),
      ['basic', 'fitViewNoUpscale'],
      normalized.view.fitNoUpscale,
      {
        help: this.t('configModal.basic.fitViewNoUpscale.help'),
      }
    );
    const fitMaxScaleInput = this.createNumberField(
      this.t('configModal.basic.fitViewMaxScale'),
      ['basic', 'fitViewMaxScale'],
      normalized.view.fitMaxScale,
      {
        min: FIT_VIEW_MAX_SCALE_MIN,
        max: FIT_VIEW_MAX_SCALE_MAX,
        step: 0.1,
        placeholder: this.t('configModal.basic.placeholder.default'),
        help: this.t('configModal.basic.fitViewMaxScale.help'),
      }
    );
    const syncFitViewSubControls = () => {
      const isFitView = viewFitSelect.value === 'fit';
      this.setFieldHidden(fitNoUpscaleToggle, !isFitView);
      this.setFieldHidden(fitMaxScaleInput, !isFitView || fitNoUpscaleToggle.checked);
    };
    viewFitSelect.addEventListener('change', syncFitViewSubControls);
    fitNoUpscaleToggle.addEventListener('change', () => {
      setConfigValue(this.draftConfig, ['basic', 'viewFit'], 'fit');
      this.syncInheritedValueStyle(viewFitSelect._yonxaoMindmapControlEl, ['basic', 'viewFit']);
      syncFitViewSubControls();
    });
    fitMaxScaleInput.addEventListener('input', () => {
      setConfigValue(this.draftConfig, ['basic', 'viewFit'], 'fit');
      setConfigValue(this.draftConfig, ['basic', 'fitViewNoUpscale'], false);
      this.syncInheritedValueStyle(viewFitSelect._yonxaoMindmapControlEl, ['basic', 'viewFit']);
      this.syncInheritedValueStyle(fitNoUpscaleToggle._yonxaoMindmapControlEl, [
        'basic',
        'fitViewNoUpscale',
      ]);
    });
    syncFitViewSubControls();
    this.createSelectField(
      this.t('configModal.basic.toolbarCorner'),
      ['basic', 'toolbar', 'corner'],
      normalized.toolbar.corner,
      this.toolbarCornerOptions()
    );
    this.createSelectField(
      this.t('configModal.basic.toolbarPlacement'),
      ['basic', 'toolbar', 'placement'],
      normalized.toolbar.placement,
      this.toolbarPlacementOptions()
    );
    this.createSection(this.t('configModal.basic.featureSection'));
    this.createToggleField(
      this.t('configModal.basic.tabIndent'),
      ['basic', 'tabIndent'],
      normalized.source.enableTabIndent,
      {
        help: this.t('configModal.basic.tabIndent.help'),
      }
    );
    this.createToggleField(
      this.t('configModal.basic.wheelZoom'),
      ['basic', 'wheelZoom'],
      normalized.interaction.wheelZoom,
      {
        help: this.t('configModal.basic.wheelZoom.help'),
      }
    );
  },
};
