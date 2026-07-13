/*
 * 文件作用：
 * 水印选项卡专用字段控件，统一处理分段单选和带上下限的数字步进器。
 */

import { getConfigValue, numberFromInput } from './configModalShared.js';

export const watermarkFieldMethods = {
  /* 二到三个互斥选项使用分段单选，避免下拉框隐藏当前可选范围。 */
  createWatermarkChoiceField(label, path, normalizedValue, choices, options = {}) {
    const inheritedValue = this.prepareConfigFieldDefault(path, normalizedValue);
    const controlEl = this.createField(label);
    this.syncInheritedValueStyle(controlEl, path);
    const groupEl = controlEl.createDiv({ cls: 'yonxao-mindmap-watermark-choice-group' });
    this._watermarkChoiceCounter = (this._watermarkChoiceCounter || 0) + 1;
    const name = `yonxao-watermark-choice-${this._watermarkChoiceCounter}`;
    const currentValue = String(getConfigValue(this.draftConfig, path, inheritedValue));

    for (const [value, text] of choices) {
      const choiceEl = groupEl.createEl('label', { cls: 'yonxao-mindmap-watermark-choice' });
      const input = choiceEl.createEl('input');
      input.type = 'radio';
      input.name = name;
      input.value = value;
      input.checked = currentValue === value;
      choiceEl.createSpan({ text });
      input.addEventListener('change', () => {
        if (!input.checked) return;
        this.setConfigValueOrDeleteInherited(path, value, inheritedValue);
        this.syncInheritedValueStyle(controlEl, path);
        if (options.rerender) this.render();
      });
    }
    return currentValue;
  },

  createWatermarkNumberStepper(label, path, normalizedValue, options) {
    const controlEl = this.createField(label);
    this.syncInheritedValueStyle(controlEl, path);
    this.createWatermarkStepperControl(controlEl, '', path, normalizedValue, {
      ...options,
      stateControlEl: controlEl,
    });
  },

  createWatermarkNumberPair(label, fields) {
    const controlEl = this.createField(label);
    const pairEl = controlEl.createDiv({ cls: 'yonxao-mindmap-watermark-number-pair' });
    const syncPairInheritedStyle = () => {
      const isInherited = fields.every((field) => !this.hasDraftConfigPath(field.path));
      controlEl.classList.toggle('is-inherited-value', isInherited);
      controlEl.parentElement?.classList.toggle('is-inherited-value', isInherited);
    };
    for (const field of fields) {
      this.createWatermarkStepperControl(pairEl, field.label, field.path, field.value, {
        ...field,
        onValueChange: syncPairInheritedStyle,
      });
    }
    syncPairInheritedStyle();
  },

  createWatermarkStepperControl(parentEl, label, path, normalizedValue, options) {
    const inheritedValue = this.prepareConfigFieldDefault(path, normalizedValue ?? '');
    const itemEl = parentEl.createDiv({ cls: 'yonxao-mindmap-watermark-number-item' });
    if (label) itemEl.createSpan({ cls: 'yonxao-mindmap-watermark-number-label', text: label });
    const stepperEl = itemEl.createDiv({ cls: 'yonxao-mindmap-watermark-stepper' });
    const decreaseButton = stepperEl.createEl('button', { text: '−', type: 'button' });
    const input = stepperEl.createEl('input');
    const increaseButton = stepperEl.createEl('button', { text: '+', type: 'button' });
    const scale = options.displayScale || 1;
    const displayMin = options.min * scale;
    const displayMax = options.max * scale;
    const displayStep = options.step * scale;
    const currentValue = getConfigValue(this.draftConfig, path, inheritedValue);
    const syncItemInheritedStyle = () => {
      itemEl.classList.toggle('is-inherited-value', !this.hasDraftConfigPath(path));
    };
    input.type = 'number';
    input.min = String(displayMin);
    input.max = String(displayMax);
    input.step = String(displayStep);
    input.value = String(Number(currentValue) * scale);
    input.setAttribute('aria-label', label || this.t('configModal.watermark.value'));
    decreaseButton.setAttribute('aria-label', this.t('configModal.watermark.decrease'));
    increaseButton.setAttribute('aria-label', this.t('configModal.watermark.increase'));
    if (options.suffix) {
      stepperEl.createSpan({ cls: 'yonxao-mindmap-watermark-unit', text: options.suffix });
    }

    const storeDisplayValue = (displayValue, clampValue = false) => {
      if (displayValue === '') {
        input.setCustomValidity('');
        this.setConfigValueOrDeleteInherited(path, '', inheritedValue);
        if (clampValue) {
          // 清空后失焦代表恢复继承值，显示行为与配置面板其他数字字段一致。
          input.value = String(Number(inheritedValue) * scale);
        }
        syncItemInheritedStyle();
        if (options.stateControlEl) {
          this.syncInheritedValueStyle(options.stateControlEl, path);
        }
        options.onValueChange?.();
        return;
      }
      let nextDisplayValue = Number(displayValue);
      if (!Number.isFinite(nextDisplayValue)) return;
      const isOutOfRange = nextDisplayValue < displayMin || nextDisplayValue > displayMax;
      input.setCustomValidity(
        isOutOfRange ? `${this.t('configModal.watermark.range')} ${displayMin}–${displayMax}` : ''
      );
      if (isOutOfRange && !clampValue) return;
      nextDisplayValue = Math.min(displayMax, Math.max(displayMin, nextDisplayValue));
      input.value = String(nextDisplayValue);
      const nextValue = Number((nextDisplayValue / scale).toFixed(4));
      this.setConfigValueOrDeleteInherited(path, nextValue, inheritedValue);
      syncItemInheritedStyle();
      if (options.stateControlEl) {
        this.syncInheritedValueStyle(options.stateControlEl, path);
      }
      options.onValueChange?.();
    };
    input.addEventListener('input', () => storeDisplayValue(numberFromInput(input.value)));
    input.addEventListener('blur', () => storeDisplayValue(numberFromInput(input.value), true));
    const stepBy = (direction) => {
      const currentDisplayValue = Number(input.value || Number(inheritedValue) * scale);
      storeDisplayValue(currentDisplayValue + displayStep * direction, true);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    decreaseButton.addEventListener('click', () => stepBy(-1));
    increaseButton.addEventListener('click', () => stepBy(1));
    syncItemInheritedStyle();
  },
};
