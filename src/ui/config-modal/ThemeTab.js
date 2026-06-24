/*
 * 文件作用：
 * 配置面板主题页方法集合，负责主题色系、默认主题颜色和按钮颜色配置。
 *
 * 实现逻辑：
 * 根据主题方案决定是否提示默认主题色覆盖分支颜色，并提供颜色预设快捷输入。
 *
 * 调用链：
 * ConfigModal.render() -> themeTabMethods -> configFields/configModalRules。
 */

import {
  BUTTON_COLOR_MODES,
  normalizeMindConfig,
  RAINBOW_THEME_NAMES,
} from './configModalShared.js';

export const themeTabMethods = {
  renderThemeTab(normalized) {
    this.createSection(this.t('configModal.theme.section'));
    const themeField = this.createSelectTextField(
      this.t('configModal.theme.scheme'),
      ['theme', 'scheme'],
      normalized.theme,
      this.themeOptions()
    );
    const colorField = this.createColorTextField(
      this.t('configModal.theme.defaultTopicColor'),
      ['theme', 'defaultTopicColor'],
      normalized.topic.defaultColor,
      this.t('configModal.theme.defaultTopicColor.help')
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

    const buttonColorModeOptions = BUTTON_COLOR_MODES.map((mode) => [
      mode,
      this.t(`configModal.theme.buttonColor.${mode}`),
    ]);
    const buttonColorModeSelect = this.createSelectField(
      this.t('configModal.theme.buttonColorMode'),
      ['theme', 'buttonColorMode'],
      normalized.button?.colorMode || 'inherit-accent',
      buttonColorModeOptions,
      { help: this.t('configModal.theme.buttonColorMode.help') }
    );

    const customColorField = this.createColorTextField(
      this.t('configModal.theme.buttonColor'),
      ['theme', 'buttonColor'],
      normalized.button?.color || '',
      this.t('configModal.theme.buttonColor.help')
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
    warningEl.setText(shouldWarn ? this.t('configModal.theme.overrideWarning') : '');
    warningEl.hidden = !shouldWarn;
  },
};
