/*
 * 文件作用：
 * 配置面板水印页的两步解锁流程。解锁采用用户自行确认，不读取或校验 GitHub 账号。
 */

import { Notice } from 'obsidian';

import { PROJECT_REPOSITORY_URL } from '../../constants.js';

const WATERMARK_UNLOCK_CONFIRM_STEP = 'confirm';
const WATERMARK_UNLOCK_CONFIRM_DELAY_MS = 60 * 1000;

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
      this.configureWatermarkUnlockCountdown(unlockButton);
      unlockButton.addEventListener('click', () => this.confirmWatermarkUnlock(unlockButton));
      const reopenButton = actionsEl.createEl('button', {
        text: this.t('configModal.watermark.locked.reopen'),
        type: 'button',
      });
      reopenButton.addEventListener('click', () => this.openWatermarkStarPage(false));

      // 保留“已 Star 用户直接确认”的文案和解锁逻辑，但默认不渲染入口，避免流程过于显眼。
      return;
    }

    const starButton = actionsEl.createEl('button', {
      text: this.t('configModal.watermark.locked.star'),
      type: 'button',
    });
    starButton.classList.add('mod-cta');
    starButton.addEventListener('click', () => this.openWatermarkStarPage(true));
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
    this.watermarkUnlockConfirmAvailableAt = Date.now() + WATERMARK_UNLOCK_CONFIRM_DELAY_MS;
    this.render();
  },

  configureWatermarkUnlockCountdown(button) {
    const updateButtonState = () => {
      const remainingMs = Number(this.watermarkUnlockConfirmAvailableAt || 0) - Date.now();
      const remainingSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
      button.disabled = remainingSeconds > 0;
      button.textContent = this.t('configModal.watermark.locked.unlock');
      return remainingSeconds;
    };

    // 只限制刚从“前往 GitHub”进入的主确认按钮；已支持过的用户仍可走下方自行确认入口。
    if (updateButtonState() <= 0) return;
    this.watermarkUnlockCountdownTimer = window.setInterval(() => {
      if (updateButtonState() > 0) return;
      this.clearWatermarkUnlockCountdown();
    }, 1000);
  },

  /*
   * 清理解锁倒计时定时器。幂等调用安全：
   * - ConfigModal.onClose 触发一次
   * - ConfigModal.render 在每次重渲染前触发一次
   * - configureWatermarkUnlockCountdown 在倒计时归零后自清理一次
   */
  clearWatermarkUnlockCountdown() {
    if (!this.watermarkUnlockCountdownTimer) return;
    window.clearInterval(this.watermarkUnlockCountdownTimer);
    this.watermarkUnlockCountdownTimer = null;
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
