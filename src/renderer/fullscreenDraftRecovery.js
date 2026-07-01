/*
 * 全屏待保存快照恢复。
 *
 * 设计目标：
 * 只做轻量兜底，不自动覆盖原代码块；恢复时要么在原导图下方创建新导图，
 * 要么把残留源码复制到剪贴板，由用户自行处理冲突。
 */

import { CODE_BLOCK_NAME } from '../constants.js';
import { insertCodeBlockAfterSource } from '../markdown/codeBlock.js';
import { Notice } from '../shared/rendererShared.js';

const FULLSCREEN_DRAFT_STORAGE_PREFIX = 'yonxao-mindmap:fullscreen-draft:v1:';
const FULLSCREEN_DRAFT_VERSION = 1;
const FULLSCREEN_DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const FULLSCREEN_DRAFT_BLOCK_LINE_PREFIX = 'line';
const FULLSCREEN_DRAFT_BLOCK_EDITOR_PREFIX = 'editor';

function fullscreenDraftStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function encodeStoragePart(value) {
  return encodeURIComponent(String(value || 'unknown'));
}

function fullscreenDraftVaultId(plugin) {
  return plugin?.app?.vault?.getName?.() || 'unknown-vault';
}

function hashText(text) {
  let hash = 2166136261;
  const value = String(text || '');
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function snapshotExpired(snapshot) {
  return !snapshot?.updatedAt || Date.now() - snapshot.updatedAt > FULLSCREEN_DRAFT_EXPIRY_MS;
}

function createDraftSourceCodeBlock(source) {
  return `\`\`\`${CODE_BLOCK_NAME}\n${String(source || '')}\n\`\`\``;
}

async function writeClipboardText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

export const fullscreenDraftRecoveryMethods = {
  initializeFullscreenDraftRecovery() {
    this.fullscreenDraftIdentity = this.buildFullscreenDraftIdentity();
    this.pendingFullscreenDraftSnapshot = this.findRecoverableFullscreenDraftSnapshot();
  },

  buildFullscreenDraftIdentity() {
    const sourcePath = this.ctx?.sourcePath || '';
    if (!sourcePath) return null;

    const blockKey = this.fullscreenDraftBlockKey();
    if (!blockKey) return null;

    return {
      vaultId: fullscreenDraftVaultId(this.plugin),
      sourcePath,
      blockKey,
      baseFingerprint: hashText(this.source),
    };
  },

  fullscreenDraftBlockKey() {
    const sectionInfo = this.currentCodeBlockSectionInfo();
    if (sectionInfo && Number.isFinite(sectionInfo.lineStart)) {
      return `${FULLSCREEN_DRAFT_BLOCK_LINE_PREFIX}:${sectionInfo.lineStart}`;
    }

    if (this.editorContext && Number.isFinite(this.editorContext.contentFrom)) {
      return `${FULLSCREEN_DRAFT_BLOCK_EDITOR_PREFIX}:${this.editorContext.contentFrom}`;
    }
    return null;
  },

  currentCodeBlockSectionInfo() {
    return this.ctx && typeof this.ctx.getSectionInfo === 'function'
      ? this.ctx.getSectionInfo(this.hostEl)
      : null;
  },

  fullscreenDraftStorageKey(identity = this.fullscreenDraftIdentity) {
    if (!identity?.sourcePath || !identity?.blockKey) return '';
    return `${FULLSCREEN_DRAFT_STORAGE_PREFIX}${encodeStoragePart(
      identity.vaultId
    )}:${encodeStoragePart(identity.sourcePath)}:${encodeStoragePart(identity.blockKey)}`;
  },

  writeFullscreenDraftSnapshot(draftSource) {
    const storage = fullscreenDraftStorage();
    const identity = this.fullscreenDraftIdentity || this.buildFullscreenDraftIdentity();
    const key = this.fullscreenDraftStorageKey(identity);
    if (!storage || !identity || !key) return;

    try {
      storage.setItem(
        key,
        JSON.stringify({
          version: FULLSCREEN_DRAFT_VERSION,
          vaultId: identity.vaultId,
          sourcePath: identity.sourcePath,
          blockKey: identity.blockKey,
          baseFingerprint: identity.baseFingerprint,
          draftFingerprint: hashText(draftSource),
          draftSource,
          updatedAt: Date.now(),
        })
      );
    } catch (error) {
      console.warn('yonxao-mindmap: 全屏待保存快照写入失败', error);
    }
  },

  clearFullscreenDraftSnapshot(snapshot = this.pendingFullscreenDraftSnapshot) {
    const storage = fullscreenDraftStorage();
    const key = snapshot?.storageKey || this.fullscreenDraftStorageKey();
    if (!storage || !key) return;

    try {
      storage.removeItem(key);
    } catch (error) {
      console.warn('yonxao-mindmap: 全屏待保存快照清理失败', error);
    }
  },

  findRecoverableFullscreenDraftSnapshot() {
    const storage = fullscreenDraftStorage();
    const identity = this.fullscreenDraftIdentity;
    if (!storage || !identity) return null;

    const currentFingerprint = hashText(this.source);

    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const storageKey = storage.key(index);
      if (!storageKey?.startsWith(FULLSCREEN_DRAFT_STORAGE_PREFIX)) continue;

      let snapshot;
      try {
        snapshot = JSON.parse(storage.getItem(storageKey) || 'null');
      } catch {
        storage.removeItem(storageKey);
        continue;
      }

      if (!snapshot || snapshot.version !== FULLSCREEN_DRAFT_VERSION || snapshotExpired(snapshot)) {
        storage.removeItem(storageKey);
        continue;
      }
      if (
        snapshot.vaultId !== identity.vaultId ||
        snapshot.sourcePath !== identity.sourcePath ||
        snapshot.blockKey !== identity.blockKey
      ) {
        continue;
      }

      if (snapshot.draftFingerprint === currentFingerprint) {
        storage.removeItem(storageKey);
        return null;
      }
      if (snapshot.baseFingerprint !== currentFingerprint || !snapshot.draftSource) {
        return null;
      }

      return { ...snapshot, storageKey };
    }

    return null;
  },

  renderFullscreenDraftRecoveryPrompt() {
    const snapshot = this.pendingFullscreenDraftSnapshot;
    if (!snapshot || this.fullscreenDraftRecoveryEl) return;

    const promptEl = this.hostEl.createDiv({ cls: 'yonxao-mindmap-recovery-prompt' });
    this.fullscreenDraftRecoveryEl = promptEl;
    promptEl.createDiv({
      cls: 'yonxao-mindmap-recovery-text',
      text: this.t('fullscreenDraftRecovery.message'),
    });

    const actionsEl = promptEl.createDiv({ cls: 'yonxao-mindmap-recovery-actions' });
    const createButton = actionsEl.createEl('button', {
      cls: 'yonxao-mindmap-recovery-button',
      text: this.t('fullscreenDraftRecovery.createMap'),
    });
    createButton.type = 'button';
    createButton.addEventListener('click', () => {
      this.handleFullscreenDraftRecoveryAction(() => this.createRecoveredDraftMap(snapshot));
    });

    const copyButton = actionsEl.createEl('button', {
      cls: 'yonxao-mindmap-recovery-button',
      text: this.t('fullscreenDraftRecovery.copySource'),
    });
    copyButton.type = 'button';
    copyButton.addEventListener('click', () => {
      this.handleFullscreenDraftRecoveryAction(() => this.copyRecoveredDraftSource(snapshot));
    });
  },

  handleFullscreenDraftRecoveryAction(action) {
    const buttons = this.fullscreenDraftRecoveryEl?.querySelectorAll('button') || [];
    for (const button of buttons) {
      button.disabled = true;
    }

    Promise.resolve()
      .then(action)
      .catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      })
      .finally(() => {
        if (!this.fullscreenDraftRecoveryEl) return;
        for (const button of buttons) {
          button.disabled = false;
        }
      });
  },

  async createRecoveredDraftMap(snapshot) {
    if (!snapshot?.draftSource) return false;

    const inserted = await this.insertRecoveredDraftMapAfterCurrentBlock(snapshot.draftSource);
    if (!inserted) {
      new Notice(this.t('fullscreenDraftRecovery.insertFailed'));
      return false;
    }

    this.clearRecoveredDraftPrompt(snapshot);
    new Notice(this.t('fullscreenDraftRecovery.inserted'));
    return true;
  },

  async insertRecoveredDraftMapAfterCurrentBlock(draftSource) {
    if (this.editorContext) {
      new Notice(this.t('fullscreenDraftRecovery.insertUnsupported'));
      return false;
    }

    const file = this.getMarkdownFile();
    if (!file) return false;

    const originalMarkdown = await this.plugin.app.vault.read(file);
    const nextMarkdown = insertCodeBlockAfterSource(
      originalMarkdown,
      CODE_BLOCK_NAME,
      this.source,
      draftSource,
      this.currentCodeBlockSectionInfo()
    );
    if (nextMarkdown === null) return false;

    await this.plugin.app.vault.modify(file, nextMarkdown);
    return true;
  },

  async copyRecoveredDraftSource(snapshot) {
    if (!snapshot?.draftSource) return false;

    const copied = await writeClipboardText(createDraftSourceCodeBlock(snapshot.draftSource));
    if (!copied) {
      new Notice(this.t('fullscreenDraftRecovery.copyFailed'));
      return false;
    }

    this.clearRecoveredDraftPrompt(snapshot);
    new Notice(this.t('fullscreenDraftRecovery.copied'));
    return true;
  },

  clearRecoveredDraftPrompt(snapshot) {
    this.clearFullscreenDraftSnapshot(snapshot);
    this.pendingFullscreenDraftSnapshot = null;
    this.fullscreenDraftRecoveryEl?.remove();
    this.fullscreenDraftRecoveryEl = null;
  },
};
