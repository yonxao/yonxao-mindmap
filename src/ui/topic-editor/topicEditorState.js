/*
 * 文件作用：
 * 主题编辑状态方法集合，负责打开前快照、自定义值判断和继承样式同步。
 *
 * 实现逻辑：
 * 通过比较主题属性和有效配置判断字段是否继承，避免保存多余属性。
 *
 * 调用链：
 * TopicEditorPanel/Fields -> topicEditorStateMethods -> config helpers。
 */

import {
  Notice,
  resolveTopicFont,
  resolveTopicMaxWidth,
  removeTopicById,
  setOptionalTopicAttribute,
  assignIds,
  topicColor,
  normalizeTopicTextForStorage,
} from '../../shared/rendererShared.js';

export const topicEditorStateMethods = {
  setTopicEditorCustomState(controlEl, isCustom) {
    if (!controlEl) return;

    controlEl.dataset.topicEditorCustom = isCustom ? 'true' : 'false';
    controlEl.classList.toggle('is-inherited-value', !isCustom);
    controlEl._fieldWrapper?.classList.toggle('is-inherited-value', !isCustom);
  },

  isTopicEditorCustomValue(controlEl) {
    return controlEl?.dataset?.topicEditorCustom === 'true';
  },

  setTopicEditorNumberValue(input, value, isCustom) {
    input.value = value === null || value === undefined ? '' : String(value);
    this.setTopicEditorCustomState(input, isCustom);
  },

  restoreTopicEditorInheritedValue(key) {
    if (!this.topicEditorInheritedValues || !this.topicEditorFields) return;

    const fields = this.topicEditorFields;
    const inheritedValue = this.topicEditorInheritedValues[key];
    if (key === 'color') {
      if (this.isTopicEditorCustomValue(fields.colorField) || fields.colorField._textInput.value) {
        return;
      }
      this.setTopicEditorColorValue(inheritedValue || '', { custom: false });
      return;
    }

    const input = fields[key];
    if (!input || this.isTopicEditorCustomValue(input) || input.value) return;
    this.setTopicEditorNumberValue(input, inheritedValue ?? '', false);
  },

  topicEditorSaveValue(controlEl) {
    return this.isTopicEditorCustomValue(controlEl) ? controlEl.value : '';
  },

  resolveTopicEditorInheritedValues(topic) {
    const attributes = { ...(topic.attributes || {}) };
    for (const key of [
      'color',
      'icon',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'maxWidth',
    ]) {
      delete attributes[key];
    }

    const inheritedTopic = { ...topic, attributes };
    const font = resolveTopicFont(inheritedTopic, this.config);
    return {
      color: topicColor(inheritedTopic, this.config) || '',
      icon: '',
      fontFamily: font.family || '',
      fontSize: font.size || '',
      fontWeight: font.weight || '',
      lineHeight: font.lineHeight || '',
      maxWidth: resolveTopicMaxWidth(inheritedTopic, this.config) || '',
    };
  },

  async saveTopicEditor() {
    if (!this.canEditMindMap()) return false;

    const topic = this.topicById.get(this.editingTopicId);
    if (!topic || !this.topicEditorFields) return false;

    const text = normalizeTopicTextForStorage(this.topicEditorFields.text.value);
    if (!text) {
      new Notice(this.t('notice.topicTextRequired'));
      return false;
    }

    for (const field of [
      this.topicEditorFields.fontSize,
      this.topicEditorFields.fontWeight,
      this.topicEditorFields.lineHeight,
      this.topicEditorFields.maxWidth,
    ]) {
      if (field.value && !field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }

    const customFontInput = this.topicEditorFields.fontFamilyField?._customInput;
    if (customFontInput && !customFontInput.hidden && !customFontInput.checkValidity()) {
      customFontInput.reportValidity();
      return false;
    }

    topic.text = text;
    setOptionalTopicAttribute(
      topic.attributes,
      'color',
      this.isTopicEditorCustomValue(this.topicEditorFields.colorField)
        ? this.topicEditorFields.color.value
        : ''
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'icon',
      this.isTopicEditorCustomValue(this.topicEditorFields.iconPicker)
        ? this.topicEditorFields.icon.value
        : ''
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'fontFamily',
      this.isTopicEditorCustomValue(this.topicEditorFields.fontFamilyField)
        ? this.topicEditorFields.fontFamily.value
        : ''
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'fontSize',
      this.topicEditorSaveValue(this.topicEditorFields.fontSize)
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'fontWeight',
      this.topicEditorSaveValue(this.topicEditorFields.fontWeight)
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'lineHeight',
      this.topicEditorSaveValue(this.topicEditorFields.lineHeight)
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'maxWidth',
      this.topicEditorSaveValue(this.topicEditorFields.maxWidth)
    );
    setOptionalTopicAttribute(topic.attributes, 'layout', '');

    const saved = await this.saveTreeToSourceAndFile('主题已保存。');
    if (saved) this.closeTopicEditor();
    return saved;
  },

  async deleteTopicFromEditor() {
    if (!this.canEditMindMap()) return false;

    const topic = this.topicById.get(this.editingTopicId);
    if (!topic || topic === this.root || topic._virtual) {
      new Notice(this.t('notice.rootCannotDeleteInMap'));
      return false;
    }

    if (!this.confirmDeleteTopic(topic)) return false;

    const removed = removeTopicById(this.root, topic.id);
    if (!removed) return false;

    assignIds(this.root, '0');
    const saved = await this.saveTreeToSourceAndFile(this.t('notice.topicDeleted'));
    if (saved) this.closeTopicEditor();
    return saved;
  },
};
