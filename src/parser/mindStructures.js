// ── 高级结构区边界标记 ──
export const STRUCTURE_BLOCK_START = '@structures';
export const STRUCTURE_BLOCK_END = '@end';
// 支持的三种高级结构类型
export const MIND_STRUCTURE_TYPES = new Set(['relation', 'summary', 'boundary']);
// 关联默认方向为正向，默认线型为曲线
export const RELATION_DEFAULT_DIRECTION = 'forward';
export const RELATION_DEFAULT_LINE_STYLE = 'curve';
export const RELATION_ANCHOR_ATTRIBUTES = ['fromAnchor', 'toAnchor'];
export const RELATION_ANCHOR_NAMES = [
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];
// 各类型结构 ID 前缀：关联 r-、概要 s-、外框 b-
export const STRUCTURE_ID_PREFIXES = { relation: 'r-', summary: 's-', boundary: 'b-' };

/*
 * 解析 @structures 区内结构定义属性中的转义值。
 * 支持 \n（换行）、\r（回车）、\\（反斜杠）、\"（双引号）、\'（单引号）。
 */
function parseQuotedStructureValue(value) {
  return value.replace(/\\(n|r|\\|"|')/g, (_match, escaped) => {
    if (escaped === 'n') return '\n';
    if (escaped === 'r') return '\r';
    return escaped;
  });
}

/*
 * 解析结构属性字符串 key=value 为对象。
 * 支持双引号 "value"、单引号 'value' 和无引号 three 种形式；
 * 带引号的 value 会经过转义处理。
 */
function parseStructureAttributes(source) {
  const attributes = {};
  const pattern = /([a-zA-Z][\w-]*)\s*=\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^\s]+))/g;
  let match;
  while ((match = pattern.exec(source))) {
    const quotedValue = match[2] ?? match[3];
    const value = quotedValue ?? match[4] ?? '';
    attributes[match[1]] = (
      quotedValue === undefined ? value : parseQuotedStructureValue(value)
    ).trim();
  }
  return attributes;
}

/*
 * 将属性值序列化为字符串。
 * 当值包含空格、引号或方括号时自动加双引号并转义内部特殊字符。
 */
function serializeStructureValue(value) {
  const text = String(value || '');
  if (/^[^\s"'[\]]+$/.test(text)) return text;
  return `"${text
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"')}"`;
}

/*
 * 将正文按 @structures/@end 切分为主题正文和高级结构列表。
 * - 如果没有 @structures 标记，直接返回空结构列表。
 * - @end 后的非空行被视为错误，防止结构区后意外写入新主题。
 */
export function splitMindStructureBlock(body) {
  const lines = String(body || '').split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === STRUCTURE_BLOCK_START);
  // 没有 @structures 块，直接返回全部正文
  if (start === -1) return { topicBody: String(body || ''), structures: [] };

  const endOffset = lines.slice(start + 1).findIndex((line) => line.trim() === STRUCTURE_BLOCK_END);
  // @structures 块缺少 @end 结尾
  if (endOffset === -1) throw new Error('高级结构区缺少 @end。');
  const end = start + 1 + endOffset;
  // @end 之后不允许出现有效内容
  if (lines.slice(end + 1).some((line) => line.trim())) {
    throw new Error('@end 后不能继续书写主题内容。');
  }

  return {
    topicBody: lines.slice(0, start).join('\n').trimEnd(),
    structures: parseMindStructures(lines.slice(start + 1, end)),
  };
}

/*
 * 解析 @structures 区内的每一行结构定义，返回结构对象数组。
 * 每行格式：@type [key=value ...]
 * - 自动补齐遗漏的 id（按类型前缀加三位序号）
 * - 校验主题引用数量、direction 和 lineStyle 合法性
 */
export function parseMindStructures(lines) {
  const structures = [];
  const ids = new Set();
  const typeCounts = { relation: 0, summary: 0, boundary: 0 };
  // 这些字段从 attributes 中分离出来作为结构对象的顶层属性，不混入 attributes
  const reserved = new Set(['id', 'from', 'to', 'topics', 'text', 'direction', 'lineStyle']);
  // 逐行解析结构定义
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    const match = line.match(/^@(relation|summary|boundary)\s+\[([\s\S]+)]$/);
    if (!match) throw new Error(`高级结构第 ${index + 1} 行格式无效：${line}`);
    const type = match[1];
    typeCounts[type] += 1;
    const attributes = parseStructureAttributes(match[2]);
    const id =
      attributes.id || `${STRUCTURE_ID_PREFIXES[type]}${String(typeCounts[type]).padStart(3, '0')}`;
    if (ids.has(id)) throw new Error(`高级结构 id 重复：${id}`);
    ids.add(id);

    const topicIds =
      type === 'relation'
        ? [attributes.from, attributes.to].filter(Boolean)
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
    // 关联类型额外校验 direction 和 lineStyle 的合法取值
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
        if (anchor && !RELATION_ANCHOR_NAMES.includes(anchor)) {
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

export function serializeMindStructures(structures, options = {}) {
  if (!structures?.length) return '';
  const lines = structures.map((structure) => {
    const values = { id: structure.id };
    if (structure.type === 'relation') {
      [values.from, values.to] = structure.topicIds;
    } else {
      values.topics = structure.topicIds.join(',');
    }
    if (structure.text) values.text = structure.text;
    const attributes = { ...(structure.attributes || {}) };
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

export function validateMindStructures(root, structures) {
  const stableIds = new Map();
  const parentById = new Map();
  const visit = (topic, parent = null) => {
    const stableId = topic.attributes?.id;
    if (stableId) {
      if (stableIds.has(stableId)) throw new Error(`主题 id 重复：${stableId}`);
      stableIds.set(stableId, topic);
      parentById.set(stableId, parent?.attributes?.id || '');
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
        .sort((a, b) => a - b);
      if (
        positions.some((value) => value < 0) ||
        positions.some((value, index) => index && value !== positions[index - 1] + 1)
      ) {
        throw new Error(`概要 ${structure.id} 只能包含连续的同级主题。`);
      }
    }
  }
  return stableIds;
}

function findTopicParentByStableChildId(topic, childStableId) {
  if (!topic) return null;
  if ((topic.subtopics || []).some((child) => child.attributes?.id === childStableId)) return topic;
  for (const child of topic.subtopics || []) {
    const match = findTopicParentByStableChildId(child, childStableId);
    if (match) return match;
  }
  return null;
}

export function findTopicByStableId(root, stableId) {
  if (!root || !stableId) return null;
  if (root.attributes?.id === stableId) return root;
  for (const subtopic of root.subtopics || []) {
    const match = findTopicByStableId(subtopic, stableId);
    if (match) return match;
  }
  return null;
}
