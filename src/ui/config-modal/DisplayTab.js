/*
 * 文件作用：
 * 配置面板显示页方法集合，负责导图/源码区域高度和打开导图时的初始视图适配。
 */

import {
  CANVAS_MAX_HEIGHT,
  CANVAS_MIN_HEIGHT,
  FIT_VIEW_MAX_SCALE_MAX,
  FIT_VIEW_MAX_SCALE_MIN,
} from './configModalShared.js';

export const displayTabMethods = {
  renderDisplayTab(normalized) {
    this.createSection(this.t('configModal.display.mapSection'));
    this.createNumberField(
      this.t('configModal.display.canvasHeight'),
      ['display', 'canvasHeight'],
      normalized.canvas.height,
      {
        min: CANVAS_MIN_HEIGHT,
        max: CANVAS_MAX_HEIGHT,
        step: 1,
        placeholder: this.t('configModal.placeholder.auto'),
        help: this.t('configModal.display.canvasHeight.help'),
      }
    );

    const viewFitSelect = this.createSelectField(
      this.t('configModal.display.viewFit'),
      ['display', 'viewFit'],
      normalized.view.fit,
      this.viewFitOptions(),
      {
        help: this.t('configModal.display.viewFit.help'),
      }
    );
    const fitNoUpscaleToggle = this.createToggleField(
      this.t('configModal.display.fitViewNoUpscale'),
      ['display', 'fitViewNoUpscale'],
      normalized.view.fitNoUpscale,
      {
        help: this.t('configModal.display.fitViewNoUpscale.help'),
      }
    );
    const fitMaxScaleInput = this.createNumberField(
      this.t('configModal.display.fitViewMaxScale'),
      ['display', 'fitViewMaxScale'],
      normalized.view.fitMaxScale,
      {
        min: FIT_VIEW_MAX_SCALE_MIN,
        max: FIT_VIEW_MAX_SCALE_MAX,
        step: 0.1,
        placeholder: this.t('configModal.placeholder.default'),
        help: this.t('configModal.display.fitViewMaxScale.help'),
      }
    );

    const syncFitViewSubControls = () => {
      const isFitView = viewFitSelect.value === 'fit';
      this.setFieldHidden(fitNoUpscaleToggle, !isFitView);
      this.setFieldHidden(fitMaxScaleInput, !isFitView || fitNoUpscaleToggle.checked);
    };

    viewFitSelect.addEventListener('change', syncFitViewSubControls);
    fitNoUpscaleToggle.addEventListener('change', () => {
      this.setConfigValueOrDeleteInherited(
        ['display', 'viewFit'],
        'fit',
        viewFitSelect._yonxaoMindmapInheritedValue
      );
      this.syncInheritedValueStyle(viewFitSelect._yonxaoMindmapControlEl, ['display', 'viewFit']);
      syncFitViewSubControls();
    });
    fitMaxScaleInput.addEventListener('input', () => {
      this.setConfigValueOrDeleteInherited(
        ['display', 'viewFit'],
        'fit',
        viewFitSelect._yonxaoMindmapInheritedValue
      );
      this.setConfigValueOrDeleteInherited(
        ['display', 'fitViewNoUpscale'],
        false,
        fitNoUpscaleToggle._yonxaoMindmapInheritedValue
      );
      this.syncInheritedValueStyle(viewFitSelect._yonxaoMindmapControlEl, ['display', 'viewFit']);
      this.syncInheritedValueStyle(fitNoUpscaleToggle._yonxaoMindmapControlEl, [
        'display',
        'fitViewNoUpscale',
      ]);
    });
    syncFitViewSubControls();

    this.createSection(this.t('configModal.display.sourceSection'));
    this.createNumberField(
      this.t('configModal.display.sourceHeight'),
      ['display', 'sourceHeight'],
      normalized.source.height,
      {
        min: CANVAS_MIN_HEIGHT,
        max: CANVAS_MAX_HEIGHT,
        step: 1,
        placeholder: this.t('configModal.placeholder.auto'),
        help: this.t('configModal.display.sourceHeight.help'),
      }
    );
  },
};
