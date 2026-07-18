/*
 * 文件作用：
 * 可视化配置面板主容器，负责生命周期、主结构和子模块组合。
 */

import { Modal } from 'obsidian';

import {
  PROJECT_README_URL,
  PROJECT_README_ZH_CN_URL,
  PROJECT_REPOSITORY_URL,
} from '../../constants.js';
import {
  canonicalizeMindConfig,
  cloneConfig,
  createTranslator,
  normalizeMindConfig,
} from './configModalShared.js';
import { displayTabMethods } from './DisplayTab.js';
import { structureTabMethods } from './StructureTab.js';
import { colorTabMethods } from './ColorTab.js';
import { fontTabMethods } from './FontTab.js';
import { interactionTabMethods } from './InteractionTab.js';
import { shortcutsTabMethods } from './ShortcutsTab.js';
import { advancedTabMethods } from './AdvancedTab.js';
import { watermarkTabMethods } from './WatermarkTab.js';
import { watermarkFieldMethods } from './WatermarkFields.js';
import { watermarkUnlockMethods } from './WatermarkUnlock.js';
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
    this.watermarkUnlocked = Boolean(options.watermarkUnlocked);
    this.onUnlockWatermark = options.onUnlockWatermark;
    this.sourcePath = options.sourcePath || '';
    this.activeTab = 'display';
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
    const footerEl = actionsEl.createDiv({ cls: 'yonxao-mindmap-config-footer' });
    footerEl.createEl('a', {
      href: PROJECT_README_URL,
      text: 'Docs',
      attr: { target: '_blank' },
    });
    footerEl.appendChild(document.createTextNode(' · '));
    footerEl.createEl('a', {
      href: PROJECT_README_ZH_CN_URL,
      text: '文档',
      attr: { target: '_blank' },
    });
    footerEl.appendChild(document.createTextNode(' · '));
    footerEl.createEl('a', {
      href: PROJECT_REPOSITORY_URL,
      text: this.t('configModal.footer.star'),
      attr: { target: '_blank' },
    });
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
    this.clearWatermarkUnlockCountdown?.();
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

    this.clearWatermarkUnlockCountdown?.();
    this.formEl.empty();
    this.formEl.classList.toggle('is-advanced', this.activeTab === 'advanced');
    const normalized = normalizeMindConfig(this.effectiveDraftConfig());

    const tabRenderers = {
      display: () => this.renderDisplayTab(normalized),
      structure: () => this.renderStructureTab(normalized),
      color: () => this.renderColorTab(normalized),
      font: () => this.renderFontTab(normalized),
      interaction: () => this.renderInteractionTab(normalized),
      shortcuts: () => this.renderShortcutsTab(),
      watermark: () => this.renderWatermarkTab(normalized),
      advanced: () => this.renderAdvancedTab(),
    };
    tabRenderers[this.activeTab]?.();

    this.updateTabs();
    this.updateActionButtons();
    this.updateStatus('');
  }
}

Object.assign(
  ConfigModal.prototype,
  displayTabMethods,
  structureTabMethods,
  colorTabMethods,
  fontTabMethods,
  interactionTabMethods,
  shortcutsTabMethods,
  watermarkFieldMethods,
  watermarkTabMethods,
  watermarkUnlockMethods,
  advancedTabMethods,
  configFieldMethods,
  configModalStateMethods,
  configModalRuleMethods
);
