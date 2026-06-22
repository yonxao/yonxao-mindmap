/*
 * 文件作用：
 * 可视化配置弹框主容器，负责生命周期、主结构和子模块组合。
 */

import { Modal } from 'obsidian';

import {
  canonicalizeMindConfig,
  cloneConfig,
  createTranslator,
  normalizeMindConfig,
} from './configModalShared.js';
import { basicTabMethods } from './BasicTab.js';
import { themeTabMethods } from './ThemeTab.js';
import { layoutTabMethods } from './LayoutTab.js';
import { fontTabMethods } from './FontTab.js';
import { advancedTabMethods } from './AdvancedTab.js';
import { configFieldMethods } from './configFields.js';
import { configModalStateMethods } from './configModalState.js';
import { configModalRuleMethods } from './configModalRules.js';

export {
  isConnectorStyleConfigurableLayout,
  isBranchExpansionSupportedLayout,
  isBranchExpansionConfigurable,
} from './configModalShared.js';

export class ConfigModal extends Modal {
  constructor(app, options) {
    super(app);
    this.t = options.t || createTranslator('en');
    this.title = options.title || this.t('configModal.title');
    this.baseConfig = cloneConfig(canonicalizeMindConfig(options.baseConfig));
    this.initialConfig = cloneConfig(canonicalizeMindConfig(options.rawConfig));
    this.draftConfig = cloneConfig(canonicalizeMindConfig(options.rawConfig));
    this.onApply = options.onApply;
    this.activeTab = 'basic';
    this.formEl = null;
    this.advancedInputEl = null;
    this.advancedEditorEl = null;
    this.advancedHighlightEl = null;
    this.advancedLineNumbersEl = null;
    this.statusEl = null;
    this.applyButton = null;
    this.saveAndCloseButton = null;
    this.cancelButton = null;
    this.dragState = null;
  }

  onOpen() {
    this.modalEl.classList.add('yonxao-mindmap-config-modal-host');
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('yonxao-mindmap-config-modal');

    const headerEl = contentEl.createDiv({ cls: 'yonxao-mindmap-config-header' });
    headerEl.createEl('h2', { text: this.title });
    this.createConfigInfoPopover(headerEl);
    this.installModalDrag(headerEl);

    const tabsEl = contentEl.createDiv({ cls: 'yonxao-mindmap-config-tabs' });
    for (const [id, label] of this.tabOptions()) {
      const button = tabsEl.createEl('button', {
        cls: 'yonxao-mindmap-config-tab',
        text: label,
      });
      button.type = 'button';
      button.classList.toggle('is-active', id === this.activeTab);
      button.addEventListener('click', () => {
        this.activeTab = id;
        this.render();
      });
    }

    this.formEl = contentEl.createDiv({ cls: 'yonxao-mindmap-config-body' });
    this.formEl.addEventListener('input', () => {
      this.updateActionButtons();
    });
    this.formEl.addEventListener('change', () => {
      this.updateActionButtons();
    });
    this.statusEl = contentEl.createDiv({ cls: 'yonxao-mindmap-config-status' });

    const actionsEl = contentEl.createDiv({ cls: 'yonxao-mindmap-config-actions' });
    this.applyButton = this.createActionButton(
      actionsEl,
      this.t('configModal.actions.apply'),
      async () => {
        await this.applyDraft(false);
      }
    );
    this.saveAndCloseButton = this.createActionButton(
      actionsEl,
      this.t('configModal.actions.saveAndClose'),
      async () => {
        await this.applyDraft(true);
      }
    );
    this.cancelButton = this.createActionButton(
      actionsEl,
      this.t('configModal.actions.cancel'),
      () => {
        this.close();
      }
    );

    this.render();
  }

  onClose() {
    this.dragState = null;
    this.modalEl.classList.remove('is-dragging-config-modal');
    this.modalEl.style.position = '';
    this.modalEl.style.left = '';
    this.modalEl.style.top = '';
    this.modalEl.style.margin = '';
    this.modalEl.style.transform = '';
    this.contentEl.empty();
  }

  render() {
    if (!this.formEl) return;

    this.formEl.empty();
    this.formEl.classList.toggle('is-advanced', this.activeTab === 'advanced');
    const normalized = normalizeMindConfig(this.effectiveDraftConfig());

    if (this.activeTab === 'basic') {
      this.renderBasicTab(normalized);
    } else if (this.activeTab === 'theme') {
      this.renderThemeTab(normalized);
    } else if (this.activeTab === 'layout') {
      this.renderLayoutTab(normalized);
    } else if (this.activeTab === 'font') {
      this.renderFontTab(normalized);
    } else {
      this.renderAdvancedTab();
    }

    this.updateTabs();
    this.updateActionButtons();
    this.updateStatus('');
  }
}

Object.assign(
  ConfigModal.prototype,
  basicTabMethods,
  themeTabMethods,
  layoutTabMethods,
  fontTabMethods,
  advancedTabMethods,
  configFieldMethods,
  configModalStateMethods,
  configModalRuleMethods
);
