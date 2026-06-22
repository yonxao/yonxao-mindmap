/*
 * 文件作用：
 * 文本复制方法集合，负责复制主题文本、子树正文、完整正文和配置区。
 *
 * 实现逻辑：
 * 复制前根据当前主题或整棵树序列化为纯文本，并通过 Obsidian Notice 反馈结果。
 *
 * 调用链：
 * 右键菜单/工具栏 -> copyTextMethods -> Clipboard API。
 */

import { Notice } from '../../shared/rendererShared.js';

export const copyTextMethods = {
  async copyTopicText(topic) {
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
    await navigator.clipboard.writeText(this.source || '');
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
    if (!this.root) return '';
    const topics = this.root._virtual ? this.root.subtopics : [this.root];
    return topics
      .map((topic) => this.serializePlainTopic(topic, 0))
      .join('\n')
      .trim();
  },

  serializePlainTopic(topic, depth) {
    const topicLevelMarker = '#'.repeat(depth + 1);
    const textLines = String(topic.text || '').split(/\r?\n/);
    const firstTextLine = textLines.shift() || '';
    const currentLine = `${topicLevelMarker} ${firstTextLine}`;
    const continuationLines = textLines.map((line) => line.trimEnd());
    const subtopicLines = topic.subtopics.map((subtopic) =>
      this.serializePlainTopic(subtopic, depth + 1)
    );
    return [currentLine, ...continuationLines, ...subtopicLines].join('\n');
  },

  plainBodyToIndentedText(body) {
    let currentLevel = 1;
    return String(body || '')
      .split(/\r?\n/)
      .map((line) => {
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        if (match) {
          currentLevel = match[1].length;
          return `${'  '.repeat(currentLevel - 1)}${match[2]}`;
        }

        if (!line.trim()) return '';
        return `${'  '.repeat(Math.max(0, currentLevel - 1))}${line}`;
      })
      .join('\n')
      .trim();
  },
};
