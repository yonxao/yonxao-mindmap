import type {
  MindStructure,
  MindStructureDocument,
  MindStructureType,
  MindTopic,
  SerializeMindStructuresOptions,
} from '../model/types.js';

export const STRUCTURE_BLOCK_START = '@structures';
export const STRUCTURE_BLOCK_END = '@end';
export const MIND_STRUCTURE_TYPES = new Set<MindStructureType>(['relation', 'summary', 'boundary']);
export const RELATION_DEFAULT_DIRECTION = 'forward';
export const RELATION_DEFAULT_LINE_STYLE = 'curve';
export const RELATION_ANCHOR_ATTRIBUTES = ['fromAnchor', 'toAnchor'] as const;
export const RELATION_ANCHOR_NAMES = [
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const;
export const STRUCTURE_ID_PREFIXES: Record<MindStructureType, string> = {
  relation: 'r-',
  summary: 's-',
  boundary: 'b-',
};

function parseQuotedStructureValue(value: string): string {
  return value.replace(/\\(n|r|\\|"|')/g, (_match, escaped: string) => {
    if (escaped === 'n') return '\n';
    if (escaped === 'r') return '\r';
    return escaped;
  });
}

function parseStructureAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([a-zA-Z][\w-]*)\s*=\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^\s]+))/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    const quotedValue = match[2] ?? match[3];
    const value = quotedValue ?? match[4] ?? '';
    attributes[match[1]] = (
      quotedValue === undefined ? value : parseQuotedStructureValue(value)
    ).trim();
  }
  return attributes;
}

function serializeStructureValue(value: unknown): string {
  const text = String(value || '');
  if (/^[^\s"'[\]]+$/.test(text)) return text;
  return `"${text
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"')}"`;
}

export function splitMindStructureBlock(body: string): MindStructureDocument {
  const source = String(body || '');
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === STRUCTURE_BLOCK_START);
  if (start === -1) return { topicBody: source, structures: [] };

  const endOffset = lines.slice(start + 1).findIndex((line) => line.trim() === STRUCTURE_BLOCK_END);
  if (endOffset === -1) throw new Error('高级结构区缺少 @end。');
  const end = start + 1 + endOffset;
  if (lines.slice(end + 1).some((line) => line.trim())) {
    throw new Error('@end 后不能继续书写主题内容。');
  }

  return {
    topicBody: lines.slice(0, start).join('\n').trimEnd(),
    structures: parseMindStructures(lines.slice(start + 1, end)),
  };
}

export function parseMindStructures(lines: readonly string[]): MindStructure[] {
  const structures: MindStructure[] = [];
  const ids = new Set<string>();
  const typeCounts: Record<MindStructureType, number> = {
    relation: 0,
    summary: 0,
    boundary: 0,
  };
  const reserved = new Set(['id', 'from', 'to', 'topics', 'text', 'direction', 'lineStyle']);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    const match = line.match(/^@(relation|summary|boundary)\s+\[([\s\S]+)]$/);
    if (!match) throw new Error(`高级结构第 ${index + 1} 行格式无效：${line}`);

    const type = match[1] as MindStructureType;
    typeCounts[type] += 1;
    const attributes = parseStructureAttributes(match[2]);
    const id =
      attributes.id || `${STRUCTURE_ID_PREFIXES[type]}${String(typeCounts[type]).padStart(3, '0')}`;
    if (ids.has(id)) throw new Error(`高级结构 id 重复：${id}`);
    ids.add(id);

    const topicIds =
      type === 'relation'
        ? [attributes.from, attributes.to].filter((value): value is string => Boolean(value))
        : String(attributes.topics || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
    if (
      (type === 'relation' && topicIds.length !== 2) ||
      (type === 'summary' && topicIds.length < 2) ||
      !topicIds.length
    ) {
      throw new Error(`高级结构 ${id} 引用的主题数量无效。`);
    }

    const structureAttributes = Object.fromEntries(
      Object.entries(attributes).filter(([key]) => !reserved.has(key))
    );
    if (type === 'relation') {
      const direction = attributes.direction || RELATION_DEFAULT_DIRECTION;
      const lineStyle = attributes.lineStyle || RELATION_DEFAULT_LINE_STYLE;
      if (!['none', 'forward', 'backward', 'both'].includes(direction)) {
        throw new Error(`关联 ${id} 的 direction 无效。`);
      }
      if (!['curve', 'straight', 'elbow'].includes(lineStyle)) {
        throw new Error(`关联 ${id} 的 lineStyle 无效。`);
      }
      for (const attributeName of RELATION_ANCHOR_ATTRIBUTES) {
        const anchor = structureAttributes[attributeName];
        if (
          anchor &&
          !RELATION_ANCHOR_NAMES.includes(anchor as (typeof RELATION_ANCHOR_NAMES)[number])
        ) {
          throw new Error(`关联 ${id} 的 ${attributeName} 无效。`);
        }
      }
      structureAttributes.direction = direction;
      structureAttributes.lineStyle = lineStyle;
    }

    structures.push({
      id,
      type,
      topicIds,
      text: attributes.text || '',
      attributes: structureAttributes,
    });
  }
  return structures;
}

export function serializeMindStructures(
  structures?: readonly MindStructure[] | null,
  options: SerializeMindStructuresOptions = {}
): string {
  if (!structures?.length) return '';
  const lines = structures.map((structure) => {
    const values: Record<string, unknown> = { id: structure.id };
    if (structure.type === 'relation') {
      [values.from, values.to] = structure.topicIds;
    } else {
      values.topics = structure.topicIds.join(',');
    }
    if (structure.text) values.text = structure.text;

    const attributes = { ...structure.attributes };
    if (structure.type === 'relation') {
      const direction = attributes.direction || RELATION_DEFAULT_DIRECTION;
      const lineStyle = attributes.lineStyle || RELATION_DEFAULT_LINE_STYLE;
      if (options.saveFullConfig || direction !== RELATION_DEFAULT_DIRECTION) {
        values.direction = direction;
      }
      if (options.saveFullConfig || lineStyle !== RELATION_DEFAULT_LINE_STYLE) {
        values.lineStyle = lineStyle;
      }
      delete attributes.direction;
      delete attributes.lineStyle;
    }

    Object.assign(values, attributes);
    const parts = Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${serializeStructureValue(value)}`);
    return `@${structure.type} [${parts.join(' ')}]`;
  });
  return [STRUCTURE_BLOCK_START, ...lines, STRUCTURE_BLOCK_END].join('\n');
}

export function validateMindStructures(
  root: MindTopic | null,
  structures?: readonly MindStructure[] | null
): Map<string, MindTopic> {
  const stableIds = new Map<string, MindTopic>();
  const parentById = new Map<string, string>();
  const visit = (topic: MindTopic, parent: MindTopic | null = null): void => {
    const stableId = topic.attributes?.id;
    if (stableId) {
      const stableIdText = String(stableId);
      if (stableIds.has(stableIdText)) throw new Error(`主题 id 重复：${stableIdText}`);
      stableIds.set(stableIdText, topic);
      parentById.set(stableIdText, String(parent?.attributes?.id || ''));
    }
    for (const subtopic of topic.subtopics || []) visit(subtopic, topic);
  };
  if (root) visit(root);

  for (const structure of structures || []) {
    for (const topicId of structure.topicIds) {
      if (!stableIds.has(topicId)) {
        throw new Error(`高级结构 ${structure.id} 引用了不存在的主题：${topicId}`);
      }
    }
    if (structure.type === 'relation' && structure.topicIds[0] === structure.topicIds[1]) {
      throw new Error(`关联 ${structure.id} 不能连接同一个主题。`);
    }
    if (structure.type === 'summary') {
      const parents = new Set(structure.topicIds.map((id) => parentById.get(id)));
      if (parents.size !== 1) throw new Error(`概要 ${structure.id} 只能包含同一父主题下的主题。`);
      const parent = findTopicParentByStableChildId(root, structure.topicIds[0]);
      const siblings = parent?.subtopics || [];
      const positions = structure.topicIds
        .map((id) => siblings.findIndex((topic) => topic.attributes?.id === id))
        .sort((left, right) => left - right);
      if (
        positions.some((value) => value < 0) ||
        positions.some((value, index) => index > 0 && value !== positions[index - 1] + 1)
      ) {
        throw new Error(`概要 ${structure.id} 只能包含连续的同级主题。`);
      }
    }
  }
  return stableIds;
}

function findTopicParentByStableChildId(
  topic: MindTopic | null,
  childStableId: string
): MindTopic | null {
  if (!topic) return null;
  if ((topic.subtopics || []).some((child) => child.attributes?.id === childStableId)) return topic;
  for (const child of topic.subtopics || []) {
    const match = findTopicParentByStableChildId(child, childStableId);
    if (match) return match;
  }
  return null;
}

export function findTopicByStableId(root: MindTopic | null, stableId: string): MindTopic | null {
  if (!root || !stableId) return null;
  if (root.attributes?.id === stableId) return root;
  for (const subtopic of root.subtopics || []) {
    const match = findTopicByStableId(subtopic, stableId);
    if (match) return match;
  }
  return null;
}
