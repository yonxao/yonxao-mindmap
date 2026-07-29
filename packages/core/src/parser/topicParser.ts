import type {
  MindTopic,
  ParsedTopicLine,
  TopicAttributes,
  TopicLevelLine,
} from '../model/types.js';

// 多个顶层主题需要合成一棵树；虚拟根只服务数据结构，不写回 yxmm。
const VIRTUAL_ROOT_TEXT = 'Mind';
const VIRTUAL_ROOT_LEVEL = 0;
const VIRTUAL_ROOT_LAYOUT = 'mindmap-bidirectional';

/*
 * 使用主题级别标记构建主题树。普通文本行会并入最近主题，保留多行主题内容。
 */
export function parseTopicMind(lines: readonly string[]): MindTopic | null {
  const roots: MindTopic[] = [];
  const stack: Array<{ level: number; topic: MindTopic }> = [];
  let currentTopic: MindTopic | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    if (!rawLine.trim()) continue;

    const topicLine = matchTopicLevelLine(rawLine.trim());
    if (!topicLine) {
      if (!currentTopic) {
        throw new Error(`第 ${lineIndex + 1} 行不是主题内容行，请先使用 #、##、### 创建主题。`);
      }

      currentTopic.text = `${currentTopic.text}\n${rawLine.trimEnd()}`;
      continue;
    }

    const parsed = parseTopicLine(topicLine.text);
    if (!parsed.text) continue;

    const topic = createMindTopic(
      parsed.text,
      parsed.attributes,
      [],
      lineIndex + 1,
      topicLine.level
    );

    // 新主题只能挂到层级更小的最近祖先下。
    while (stack.length && stack[stack.length - 1].level >= topicLine.level) {
      stack.pop();
    }

    if (stack.length) {
      stack[stack.length - 1].topic.subtopics.push(topic);
    } else {
      roots.push(topic);
    }

    stack.push({ level: topicLine.level, topic });
    currentTopic = topic;
  }

  return buildRootFromRoots(roots);
}

export function buildRootFromRoots(roots: MindTopic[]): MindTopic | null {
  if (!roots.length) return null;

  const root =
    roots.length === 1
      ? roots[0]
      : {
          id: '',
          text: VIRTUAL_ROOT_TEXT,
          attributes: { layout: VIRTUAL_ROOT_LAYOUT },
          subtopics: roots,
          line: 0,
          level: VIRTUAL_ROOT_LEVEL,
          _layout: null,
          _virtual: true,
        };

  assignIds(root, '0');
  return root;
}

export function matchTopicLevelLine(line: string): TopicLevelLine | null {
  const match = String(line).match(/^(#+)\s+(.+)$/);
  if (!match) return null;
  return {
    level: match[1].length,
    text: match[2].trim(),
  };
}

export function createMindTopic(
  text: string,
  attributes?: TopicAttributes | null,
  subtopics?: MindTopic[] | null,
  line?: number | null,
  level?: number | null
): MindTopic {
  return {
    id: '',
    text,
    attributes: attributes || {},
    subtopics: subtopics || [],
    line: line || 0,
    level: level || 1,
    _layout: null,
    _virtual: false,
  };
}

export function parseTopicLine(line: string): ParsedTopicLine {
  let current = line;
  const attributes: TopicAttributes = {};

  // 允许连续属性块；靠后的同名属性覆盖前面的值。
  while (true) {
    const match = current.match(/\s*\[([^[\]]+)]\s*$/);
    if (!match) break;
    if (!/[a-zA-Z][\w-]*\s*=/.test(match[1])) break;

    Object.assign(attributes, parseTopicAttributes(match[1]));
    current = current.slice(0, match.index).trimEnd();
  }

  return {
    text: current.trim(),
    attributes,
  };
}

export function parseTopicAttributes(source: string): TopicAttributes {
  const attributes: TopicAttributes = {};
  const topicAttributePattern = /([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
  let match: RegExpExecArray | null;

  while ((match = topicAttributePattern.exec(source))) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attributes[key] = value.trim();
  }

  return attributes;
}

export function assignIds(topic: MindTopic, id: string): void {
  topic.id = id;
  for (let index = 0; index < topic.subtopics.length; index += 1) {
    assignIds(topic.subtopics[index], `${id}.${index}`);
  }
}
