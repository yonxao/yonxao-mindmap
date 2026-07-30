import type { MindTopic } from './types.js';

/*
 * 将主题子树序列化为不含属性和配置的标题正文。
 */
export function serializePlainTopic(topic: MindTopic, depth = 0): string {
  const topicLevelMarker = '#'.repeat(Math.max(0, depth) + 1);
  const textLines = String(topic.text || '').split(/\r?\n/);
  const firstTextLine = textLines.shift() || '';
  const currentLine = `${topicLevelMarker} ${firstTextLine}`;
  const continuationLines = textLines.map((line) => line.trimEnd());
  const subtopicLines = topic.subtopics.map((subtopic) => serializePlainTopic(subtopic, depth + 1));
  return [currentLine, ...continuationLines, ...subtopicLines].join('\n');
}

/*
 * 虚拟根不进入复制结果；真实根从一级标题开始。
 */
export function serializePlainBody(root: MindTopic | null | undefined): string {
  if (!root) return '';
  const topics = root._virtual ? root.subtopics : [root];
  return topics
    .map((topic) => serializePlainTopic(topic, 0))
    .join('\n')
    .trim();
}

/*
 * 把标题层级正文转换为双空格缩进大纲，普通续行沿用最近主题层级。
 */
export function plainBodyToIndentedText(body: unknown): string {
  let currentLevel = 1;
  return String(body ?? '')
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        currentLevel = (match[1] || '#').length;
        return `${'  '.repeat(currentLevel - 1)}${match[2] || ''}`;
      }
      if (!line.trim()) return '';
      return `${'  '.repeat(Math.max(0, currentLevel - 1))}${line}`;
    })
    .join('\n')
    .trim();
}
