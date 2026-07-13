/*
 * 文件作用：
 * 配置面板水印页的两步解锁流程。解锁采用用户自行确认，不读取或校验 GitHub 账号。
 */

import { Notice } from 'obsidian';

import { PROJECT_REPOSITORY_URL } from '../../constants.js';

const WATERMARK_UNLOCK_CONFIRM_STEP = 'confirm';

export const watermarkUnlockMethods = {
  renderLockedWatermarkTab() {
    const isConfirmStep = this.watermarkUnlockStep === WATERMARK_UNLOCK_CONFIRM_STEP;
    const lockedEl = this.formEl.createDiv({ cls: 'yonxao-mindmap-watermark-locked' });
    lockedEl.createEl('h3', { text: this.t('configModal.watermark.locked.title') });
    lockedEl.createEl('p', { text: this.t('configModal.watermark.locked.description') });

    const stepsEl = lockedEl.createDiv({ cls: 'yonxao-mindmap-watermark-unlock-steps' });
    this.createWatermarkUnlockStep(
      stepsEl,
      '1',
      this.t('configModal.watermark.locked.step.star.title'),
      this.t('configModal.watermark.locked.step.star.description'),
      isConfirmStep ? 'is-complete' : 'is-active'
    );
    this.createWatermarkUnlockStep(
      stepsEl,
      '2',
      this.t('configModal.watermark.locked.step.unlock.title'),
      this.t('configModal.watermark.locked.step.unlock.description'),
      isConfirmStep ? 'is-active' : ''
    );

    const actionsEl = lockedEl.createDiv({ cls: 'yonxao-mindmap-watermark-locked-actions' });
    if (isConfirmStep) {
      const unlockButton = actionsEl.createEl('button', {
        text: this.t('configModal.watermark.locked.unlock'),
        type: 'button',
      });
      unlockButton.classList.add('mod-cta');
      unlockButton.addEventListener('click', () => this.confirmWatermarkUnlock(unlockButton));
      const reopenButton = actionsEl.createEl('button', {
        text: this.t('configModal.watermark.locked.reopen'),
        type: 'button',
      });
      reopenButton.addEventListener('click', () => this.openWatermarkStarPage(false));
      return;
    }

    const starButton = actionsEl.createEl('button', {
      text: this.t('configModal.watermark.locked.star'),
      type: 'button',
    });
    starButton.classList.add('mod-cta');
    starButton.addEventListener('click', () => this.openWatermarkStarPage(true));

    const existingSupportButton = lockedEl.createEl('button', {
      cls: 'yonxao-mindmap-watermark-existing-support',
      text: this.t('configModal.watermark.locked.existingSupport'),
      type: 'button',
    });
    existingSupportButton.addEventListener('click', () =>
      this.confirmWatermarkUnlock(existingSupportButton)
    );
  },

  createWatermarkUnlockStep(parentEl, number, title, description, stateClass) {
    const stepEl = parentEl.createDiv({ cls: 'yonxao-mindmap-watermark-unlock-step' });
    if (stateClass) stepEl.classList.add(stateClass);
    stepEl.createSpan({ cls: 'yonxao-mindmap-watermark-unlock-step-number', text: number });
    const contentEl = stepEl.createDiv();
    contentEl.createDiv({ cls: 'yonxao-mindmap-watermark-unlock-step-title', text: title });
    contentEl.createDiv({
      cls: 'yonxao-mindmap-watermark-unlock-step-description',
      text: description,
    });
  },

  openWatermarkStarPage(advanceStep) {
    window.open(PROJECT_REPOSITORY_URL, '_blank', 'noopener');
    if (!advanceStep) return;
    this.watermarkUnlockStep = WATERMARK_UNLOCK_CONFIRM_STEP;
    this.render();
  },

  async confirmWatermarkUnlock(button) {
    if (typeof this.onUnlockWatermark !== 'function') {
      new Notice(this.t('configModal.watermark.locked.failed'));
      return;
    }

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = this.t('configModal.watermark.locked.unlocking');
    try {
      await this.onUnlockWatermark();
    } catch (error) {
      console.error('yonxao-mindmap: 水印解锁状态保存失败', error);
      new Notice(this.t('configModal.watermark.locked.failed'));
      button.disabled = false;
      button.textContent = originalText;
      return;
    }

    // 只有持久化成功后才更新界面状态；解锁不自动开启水印。
    this.watermarkUnlocked = true;
    new Notice(this.t('configModal.watermark.locked.success'));
    this.render();
  },
};
