/*
 * 文件作用：
 * 配置面板配色页方法集合，负责配色方案、默认主题颜色和按钮颜色配置。
 */

import {
  BUTTON_COLOR_MODES,
  normalizeMindConfig,
  RAINBOW_THEME_NAMES,
} from './configModalShared.js';

export const colorTabMethods = {
  renderColorTab(normalized) {
    this.createSection(this.t('configModal.color.schemeSection'));
    const themeField = this.createSelectTextField(
      this.t('configModal.color.scheme'),
      ['color', 'scheme'],
      normalized.theme,
      this.themeOptions()
    );
    const colorField = this.createColorTextField(
      this.t('configModal.color.defaultTopicColor'),
      ['color', 'defaultTopicColor'],
      normalized.topic.defaultColor,
      this.t('configModal.color.defaultTopicColor.help')
    );
    const warningEl = this.createWarning('');
    const updateWarning = () => {
      this.updateThemeOverrideWarning(warningEl);
    };

    for (const element of [
      themeField.select,
      themeField.input,
      colorField.colorInput,
      colorField.textInput,
    ]) {
      element.addEventListener('input', updateWarning);
      element.addEventListener('change', updateWarning);
    }
    updateWarning();

    this.createSection(this.t('configModal.color.buttonSection'));
    const buttonColorModeOptions = BUTTON_COLOR_MODES.map((mode) => [
      mode,
      this.t(`configModal.color.buttonColor.${mode}`),
    ]);
    const buttonColorModeSelect = this.createSelectField(
      this.t('configModal.color.buttonColorMode'),
      ['color', 'buttonColorMode'],
      normalized.button?.colorMode || 'inherit-accent',
      buttonColorModeOptions,
      { help: this.t('configModal.color.buttonColorMode.help') }
    );

    const customColorField = this.createColorTextField(
      this.t('configModal.color.buttonColor'),
      ['color', 'buttonColor'],
      normalized.button?.color || '',
      this.t('configModal.color.buttonColor.help')
    );
    const updateCustomColorVisibility = () => {
      const isCustom = buttonColorModeSelect.value === 'custom';
      customColorField.fieldEl.parentElement.style.display = isCustom ? '' : 'none';
    };
    buttonColorModeSelect.addEventListener('change', updateCustomColorVisibility);
    updateCustomColorVisibility();
  },

  shouldWarnDefaultColorOverridesTheme() {
    const normalized = normalizeMindConfig(this.effectiveDraftConfig());
    const theme = String(normalized.theme || '').trim();
    const defaultColor = normalized.topic.defaultColor;
    const hasDefaultColor =
      typeof defaultColor === 'string'
        ? defaultColor.trim() !== ''
        : typeof defaultColor === 'number';

    return RAINBOW_THEME_NAMES.has(theme) && hasDefaultColor;
  },

  updateThemeOverrideWarning(warningEl) {
    const shouldWarn = this.shouldWarnDefaultColorOverridesTheme();
    warningEl.setText(shouldWarn ? this.t('configModal.color.overrideWarning') : '');
    warningEl.hidden = !shouldWarn;
  },
};
