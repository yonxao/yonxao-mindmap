import type { MindTopic, TopicAttributes, TopicAttributeValue } from '../model/types.js';

export function serializeMind(root: MindTopic): string {
  const roots = root._virtual ? root.subtopics : [root];
  return roots.map((topic) => serializeTopic(topic, 0)).join('\n');
}

export function serializeTopic(topic: MindTopic, depth: number): string {
  const topicLevelMarker = '#'.repeat(depth + 1);
  const topicAttributes = serializeTopicAttributes(topic.attributes);
  const textLines = String(topic.text || '').split(/\r?\n/);
  const firstTextLine = textLines.shift() || '';
  const currentLine = `${topicLevelMarker} ${firstTextLine}${topicAttributes}`;
  const continuationLines = textLines.map((line) => line.trimEnd());
  const subtopicLines = topic.subtopics.map((subtopic) => serializeTopic(subtopic, depth + 1));
  return [currentLine, ...continuationLines, ...subtopicLines].join('\n');
}

export function serializeTopicAttributes(attributes?: TopicAttributes | null): string {
  const topicAttributes = attributes || {};
  // 常用属性固定顺序，其余属性按名称排序，避免无意义源码 diff。
  const orderedKeys = [
    'color',
    'icon',
    'maxWidth',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'align',
    'id',
  ];
  const keys = [
    ...orderedKeys.filter((key) => topicAttributes[key]),
    ...Object.keys(topicAttributes)
      .filter((key) => topicAttributes[key] && !orderedKeys.includes(key))
      .sort(),
  ];

  if (!keys.length) return '';

  const parts = keys.map((key) => `${key}=${serializeTopicAttributeValue(topicAttributes[key])}`);
  return ` [${parts.join(' ')}]`;
}

export function serializeTopicAttributeValue(value: TopicAttributeValue): string {
  const text = String(value || '');
  if (/^[^\s"'[\]]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}
