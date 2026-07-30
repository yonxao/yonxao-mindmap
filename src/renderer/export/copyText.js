/*
 * 文件作用：
 * 文本复制方法集合，负责复制主题内容、子树正文、完整正文和配置区。
 *
 * 实现逻辑：
 * 复制前根据当前主题或整棵树序列化为纯文本，并通过 Obsidian Notice 反馈结果。
 *
 * 调用链：
 * 右键菜单/工具栏 -> copyTextMethods -> Clipboard API。
 */

import { Notice } from '../../shared/rendererShared.js';
import {
  plainBodyToIndentedText,
  serializePlainBody,
  serializePlainTopic,
} from '@yonxao/mindmap-core';
import { formatFencedMindMapSource } from './sourceFence.js';

export const copyTextMethods = {
  async copyTopicContent(topic) {
    if (!topic) return false;

    await navigator.clipboard.writeText(topic.text || '');
    new Notice(this.t('notice.topicCopied'));
    return true;
  },

  async copyPlainBody() {
    const body = this.serializePlainBody();
    await navigator.clipboard.writeText(body);
    new Notice(this.t('notice.bodyCopied'));
    return true;
  },

  async copyIndentedBody() {
    const body = this.plainBodyToIndentedText(this.serializePlainBody());
    await navigator.clipboard.writeText(body);
    new Notice(this.t('notice.bodyCopied'));
    return true;
  },

  async copyPlainSubtree(topic) {
    if (!topic) return false;

    await navigator.clipboard.writeText(this.serializePlainTopic(topic, 0));
    new Notice(this.t('notice.bodyCopied'));
    return true;
  },

  async copyIndentedSubtree(topic) {
    if (!topic) return false;

    const body = this.plainBodyToIndentedText(this.serializePlainTopic(topic, 0));
    await navigator.clipboard.writeText(body);
    new Notice(this.t('notice.bodyCopied'));
    return true;
  },

  async copyFullSource() {
    await navigator.clipboard.writeText(formatFencedMindMapSource(this.source));
    new Notice(this.t('notice.sourceCopied'));
    return true;
  },

  async copyConfigSource() {
    const sections = this.splitSourceForEditor(this.source || '');
    await navigator.clipboard.writeText(sections.config || '');
    new Notice(this.t('notice.configCopied'));
    return true;
  },

  serializePlainBody() {
    return serializePlainBody(this.root);
  },

  serializePlainTopic(topic, depth) {
    return serializePlainTopic(topic, depth);
  },

  plainBodyToIndentedText(body) {
    return plainBodyToIndentedText(body);
  },
};
