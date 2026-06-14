/*
 * 文件作用：
 * 这里集中处理 yxmm 代码块顶部的元数据配置区。
 *
 * 配置区长什么样：
 * ```yxmm
 * ---
 * canvas:
 *   height: 420
 * font:
 *   size: 14
 *   levels:
 *     1:
 *       size: 16
 * ---
 * # 中心主题
 * ```
 *
 * 设计思路：
 * - “配置区”只保存全局默认值，例如幕布高度、工具栏位置、字体和主题默认样式。
 * - “正文区”只保存 主题级别标记主题，例如 #、##、###。
 * - 标题后的主题属性 [color=...]、[fontSize=...] 仍然保留，用来覆盖全局配置。
 *
 * 调用链位置：
 * Renderer/Parser -> splitMindSourceConfig() -> normalizeMindConfig()。
 * 保存时则走 mergeMindConfig()/serializeMindSource()，把配置区和正文重新拼回代码块。
 */

import {
  CANVAS_MAX_HEIGHT,
  CANVAS_MIN_HEIGHT,
  LINE_HEIGHT,
  TOPIC_MAX_WIDTH,
} from '../constants.js';
import { DEFAULT_THEME_NAME, normalizeMindThemeName } from '../theme/mindThemes.js';
import { clamp } from '../utils/math.js';

export const FONT_SIZE_MIN = 9;
export const FONT_SIZE_MAX = 96;
export const FONT_WEIGHT_MIN = 100;
export const FONT_WEIGHT_MAX = 900;
export const FONT_LINE_HEIGHT_MIN = 12;
export const FONT_LINE_HEIGHT_MAX = 160;

export const DEFAULT_FONT_FAMILY =
  "'Sarasa Mono SC', 'Noto Sans Mono CJK SC', 'Source Han Mono SC', 'Cascadia Mono', 'JetBrains Mono', 'Liberation Mono', monospace";

/*
 * 作用：
 * 插件运行时使用的完整默认配置。
 *
 * 关键点：
 * 这个对象不是直接写回源码的模板，而是运行时兜底值。
 * 用户源码里没有写某个配置时，渲染器读取这里的默认值；保存时只写用户已有或插件主动记录的配置。
 */
export const DEFAULT_MIND_CONFIG = Object.freeze({
  canvas: Object.freeze({
    height: null,
  }),
  toolbar: Object.freeze({
    x: null,
    y: null,
  }),
  interaction: Object.freeze({
    wheelZoom: false,
  }),
  view: Object.freeze({
    mode: 'map',
  }),
  theme: DEFAULT_THEME_NAME,
  layout: 'mindmap-right',
  connector: Object.freeze({
    style: 'curve',
  }),
  font: Object.freeze({
    family: DEFAULT_FONT_FAMILY,
    size: 14,
    weight: 560,
    lineHeight: LINE_HEIGHT,
    levels: Object.freeze({}),
  }),
  topic: Object.freeze({
    defaultColor: '',
    maxWidth: TOPIC_MAX_WIDTH,
  }),
  source: Object.freeze({
    enableTabIndent: true,
    height: null,
  }),
});

/*
 * 作用：
 * 将 yxmm 源码拆成“原始配置对象”和“主题级别标记正文”。
 *
 * 实现逻辑：
 * 只有代码块第一段非空内容就是 --- 时，才认为存在配置区。
 * 这样普通主题标题里出现 --- 不会被误识别为配置。
 */
export function splitMindSourceConfig(source) {
  const text = String(source || '');
  const lines = text.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim() !== '');

  if (firstContentIndex === -1 || lines[firstContentIndex].trim() !== '---') {
    return {
      hasConfig: false,
      rawConfig: {},
      body: text,
    };
  }

  const endIndex = lines.findIndex(
    (line, index) => index > firstContentIndex && line.trim() === '---'
  );

  if (endIndex === -1) {
    throw new Error('配置区缺少结束的 ---。');
  }

  const configLines = lines.slice(firstContentIndex + 1, endIndex);
  const bodyLines = [...lines.slice(0, firstContentIndex), ...lines.slice(endIndex + 1)];

  return {
    hasConfig: true,
    rawConfig: parseSimpleYaml(configLines),
    body: bodyLines.join('\n').trimStart(),
  };
}

/*
 * 作用：
 * 把用户配置和默认配置合并成渲染器可以直接读取的规范结构。
 *
 * 关键点：
 * 这里会做数字、布尔值、枚举值的清洗，避免非法配置直接进入布局和 SVG 计算。
 */
export function normalizeMindConfig(rawConfig) {
  const raw = isPlainObject(rawConfig) ? rawConfig : {};
  const font = isPlainObject(raw.font) ? raw.font : {};
  const layout = raw.layout;
  const connector = isPlainObject(raw.connector) ? raw.connector : {};
  const topic = isPlainObject(raw.topic) ? raw.topic : {};
  const canvas = isPlainObject(raw.canvas) ? raw.canvas : {};
  const toolbar = isPlainObject(raw.toolbar) ? raw.toolbar : {};
  const interaction = isPlainObject(raw.interaction) ? raw.interaction : {};
  const view = isPlainObject(raw.view) ? raw.view : {};
  const source = isPlainObject(raw.source) ? raw.source : {};

  return {
    canvas: {
      ...canvas,
      height: normalizeOptionalNumber(canvas.height, CANVAS_MIN_HEIGHT, CANVAS_MAX_HEIGHT),
    },
    toolbar: {
      ...toolbar,
      x: normalizeOptionalNumber(toolbar.x, 0, 10000),
      y: normalizeOptionalNumber(toolbar.y, 0, 10000),
    },
    interaction: {
      ...interaction,
      wheelZoom:
        typeof interaction.wheelZoom === 'boolean'
          ? interaction.wheelZoom
          : DEFAULT_MIND_CONFIG.interaction.wheelZoom,
    },
    view: {
      ...view,
      mode: normalizeViewMode(view.mode) || DEFAULT_MIND_CONFIG.view.mode,
    },
    theme: normalizeMindThemeName(raw.theme),
    layout: normalizeLayoutType(layout) || DEFAULT_MIND_CONFIG.layout,
    connector: {
      ...connector,
      style: normalizeConnectorStyle(connector.style) || DEFAULT_MIND_CONFIG.connector.style,
    },
    font: normalizeFontConfig(font),
    topic: {
      ...topic,
      defaultColor: normalizeText(topic.defaultColor),
      maxWidth:
        normalizeOptionalNumber(topic.maxWidth, 120, 800) || DEFAULT_MIND_CONFIG.topic.maxWidth,
    },
    source: {
      ...source,
      enableTabIndent:
        typeof source.enableTabIndent === 'boolean'
          ? source.enableTabIndent
          : DEFAULT_MIND_CONFIG.source.enableTabIndent,
      height: normalizeOptionalNumber(source.height, CANVAS_MIN_HEIGHT, CANVAS_MAX_HEIGHT),
    },
  };
}

/*
 * 作用：
 * 解析 font 配置，并额外清洗 levels 下的按层级配置。
 */
export function normalizeFontConfig(rawFont) {
  const font = isPlainObject(rawFont) ? rawFont : {};
  const levels = isPlainObject(font.levels) ? font.levels : {};
  const normalizedLevels = {};

  for (const [level, value] of Object.entries(levels)) {
    if (!isPlainObject(value)) continue;
    normalizedLevels[level] = normalizePartialFont(value);
  }

  return {
    ...font,
    family: normalizeText(font.family) || DEFAULT_MIND_CONFIG.font.family,
    size:
      normalizeOptionalNumber(font.size, FONT_SIZE_MIN, FONT_SIZE_MAX) ||
      DEFAULT_MIND_CONFIG.font.size,
    weight:
      normalizeOptionalNumber(font.weight, FONT_WEIGHT_MIN, FONT_WEIGHT_MAX) ||
      DEFAULT_MIND_CONFIG.font.weight,
    lineHeight:
      normalizeOptionalNumber(font.lineHeight, FONT_LINE_HEIGHT_MIN, FONT_LINE_HEIGHT_MAX) ||
      DEFAULT_MIND_CONFIG.font.lineHeight,
    levels: normalizedLevels,
  };
}

/*
 * 作用：
 * 规范化某一层级或某个主题覆盖用的字体片段。
 */
export function normalizePartialFont(rawFont) {
  const font = isPlainObject(rawFont) ? rawFont : {};
  return {
    ...font,
    family: normalizeText(font.family),
    size: normalizeOptionalNumber(font.size, FONT_SIZE_MIN, FONT_SIZE_MAX),
    weight: normalizeOptionalNumber(font.weight, FONT_WEIGHT_MIN, FONT_WEIGHT_MAX),
    lineHeight: normalizeOptionalNumber(
      font.lineHeight,
      FONT_LINE_HEIGHT_MIN,
      FONT_LINE_HEIGHT_MAX
    ),
  };
}

/*
 * 作用：
 * 计算某个主题最终使用的字体。
 *
 * 优先级：
 * 主题属性 > font.levels[层级] > font 全局配置 > 默认值。
 */
export function resolveTopicFont(topic, config) {
  const safeConfig = normalizeMindConfig(config);
  const levelKey = String(topic.level || 1);
  const levelFont = safeConfig.font.levels[levelKey] || {};
  const attributes = topic.attributes || {};

  return {
    family: normalizeText(attributes.fontFamily) || levelFont.family || safeConfig.font.family,
    size:
      normalizeOptionalNumber(attributes.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX) ||
      levelFont.size ||
      safeConfig.font.size,
    weight:
      normalizeOptionalNumber(attributes.fontWeight, FONT_WEIGHT_MIN, FONT_WEIGHT_MAX) ||
      levelFont.weight ||
      safeConfig.font.weight,
    lineHeight:
      normalizeOptionalNumber(attributes.lineHeight, FONT_LINE_HEIGHT_MIN, FONT_LINE_HEIGHT_MAX) ||
      levelFont.lineHeight ||
      safeConfig.font.lineHeight,
  };
}

/*
 * 作用：
 * 更新配置对象中的某条路径，并返回新的配置对象。
 *
 * 调用场景：
 * 高度拖拽条结束后写入 canvas.height；工具栏拖动结束后写入 toolbar.x/y。
 */
export function setMindConfigPath(rawConfig, path, value) {
  const next = clonePlainObject(rawConfig);
  let current = next;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    if (!isPlainObject(current[key])) current[key] = {};
    current = current[key];
  }

  current[path[path.length - 1]] = value;
  return next;
}

/*
 * 作用：
 * 删除配置对象中的某条路径，并清理空父级。
 *
 * 调用场景：
 * 用户双击高度拖拽条恢复自动高度时，删除 canvas.height。
 */
export function deleteMindConfigPath(rawConfig, path) {
  const next = clonePlainObject(rawConfig);
  const parents = [];
  let current = next;

  for (const key of path.slice(0, -1)) {
    if (!isPlainObject(current[key])) return next;
    parents.push([current, key]);
    current = current[key];
  }

  delete current[path[path.length - 1]];

  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const [parent, key] = parents[index];
    if (isPlainObject(parent[key]) && !Object.keys(parent[key]).length) {
      delete parent[key];
    }
  }

  return next;
}

/*
 * 作用：
 * 把配置对象和正文重新拼成完整 yxmm 源码。
 */
export function serializeMindSource(rawConfig, body, forceConfig) {
  const config = clonePlainObject(rawConfig);
  const bodyText = String(body || '').trim();
  const shouldWriteConfig = forceConfig || hasMeaningfulConfig(config);

  if (!shouldWriteConfig) return bodyText;

  const configText = stringifySimpleYaml(config);
  return ['---', configText, '---', '', bodyText].join('\n').trimEnd();
}

/*
 * 作用：
 * 判断配置对象里是否真的有内容。
 */
export function hasMeaningfulConfig(config) {
  return isPlainObject(config) && Object.keys(config).length > 0;
}

/*
 * 作用：
 * 解析一个小型 YAML 子集。
 *
 * 实现逻辑：
 * 这里不做完整 YAML 解析，只支持插件配置需要的“缩进对象 + 标量值”。
 * 这样可以避免引入额外依赖，同时保持配置结构足够直观。
 */
export function parseSimpleYaml(lines) {
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (const rawLine of lines) {
    const withoutComment = stripYamlComment(rawLine);
    if (!withoutComment.trim()) continue;

    const indent = withoutComment.match(/^ */)?.[0].length || 0;
    if (indent % 2 !== 0) {
      throw new Error('配置区缩进请使用 2 个空格。');
    }

    const line = withoutComment.trim();
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error(`配置行缺少冒号：${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    if (!key) {
      throw new Error(`配置行缺少键名：${line}`);
    }

    while (stack.length && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].value;
    if (rawValue === '') {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
    } else {
      parent[key] = parseYamlScalar(rawValue);
    }
  }

  return root;
}

/*
 * 作用：
 * 将对象序列化为简单 YAML 文本。
 */
export function stringifySimpleYaml(value, depth = 0, path = []) {
  if (!isPlainObject(value)) return '';

  const indent = '  '.repeat(depth);
  const lines = [];

  for (const [key, entryValue] of orderedConfigEntries(value, path)) {
    if (entryValue === undefined || entryValue === null || entryValue === '') continue;

    if (isPlainObject(entryValue)) {
      if (!Object.keys(entryValue).length) continue;
      lines.push(`${indent}${key}:`);
      lines.push(stringifySimpleYaml(entryValue, depth + 1, [...path, key]));
    } else {
      lines.push(`${indent}${key}: ${stringifyYamlScalar(entryValue)}`);
    }
  }

  return lines.filter(Boolean).join('\n');
}

/*
 * 作用：
 * 让配置区输出保持稳定顺序。
 *
 * 关键点：
 * font 下先输出全局字体字段，再输出 levels；每个 level 内也按 family/size/weight/lineHeight 排序。
 * 这样配置区读起来像“先全局、再局部覆盖”，不会出现 levels 插在 size 和 weight 中间的情况。
 */
function orderedConfigEntries(value, path) {
  const entries = Object.entries(value);
  const order = configKeyOrder(path);
  if (!order.length) return entries;

  return entries.sort(([left], [right]) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    const safeLeftIndex = leftIndex === -1 ? Number.POSITIVE_INFINITY : leftIndex;
    const safeRightIndex = rightIndex === -1 ? Number.POSITIVE_INFINITY : rightIndex;

    if (safeLeftIndex !== safeRightIndex) return safeLeftIndex - safeRightIndex;
    return left.localeCompare(right);
  });
}

/*
 * 作用：
 * 根据当前 YAML 路径返回推荐的键顺序。
 */
function configKeyOrder(path) {
  const keyPath = path.join('.');
  if (keyPath === '') {
    return [
      'canvas',
      'source',
      'toolbar',
      'interaction',
      'theme',
      'layout',
      'connector',
      'topic',
      'font',
    ];
  }
  if (keyPath === 'connector') return ['style'];
  if (keyPath === 'interaction') return ['wheelZoom'];
  if (keyPath === 'font') return ['family', 'size', 'weight', 'lineHeight', 'levels'];
  if (/^font\.levels\.[^.]+$/.test(keyPath)) {
    return ['family', 'size', 'weight', 'lineHeight'];
  }
  return [];
}

/*
 * 作用：
 * 解析 YAML 标量值，支持字符串、数字和布尔值。
 */
function parseYamlScalar(value) {
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);

  const quoted = value.match(/^(['"])(.*)\1$/);
  if (quoted) return quoted[2].replace(/\\"/g, '"').replace(/\\'/g, "'");

  return value;
}

/*
 * 作用：
 * 序列化 YAML 标量值；包含特殊字符时自动加引号。
 */
function stringifyYamlScalar(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = String(value || '');
  // YAML 中冒号后面的 # 会被当成注释开头。
  // 因此 hex 颜色这类包含 # 的字符串必须加引号，否则 defaultColor: #66ed0c 会被读成空值。
  if (/^[a-zA-Z0-9_./-]+$/.test(text)) return text;
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/*
 * 作用：
 * 移除 YAML 行内注释，同时避免删除引号内的 #。
 */
function stripYamlComment(line) {
  let quote = '';

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
      quote = quote === char ? '' : quote || char;
    }
    if (char === '#' && !quote && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index);
    }
  }

  return line;
}

/*
 * 作用：
 * 深拷贝普通对象，避免保存配置时直接修改旧引用。
 */
function clonePlainObject(value) {
  if (!isPlainObject(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

/*
 * 作用：
 * 判断一个值是否为普通对象。
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/*
 * 作用：
 * 把值转成去掉首尾空白的字符串。
 */
function normalizeText(value) {
  if (value && typeof value === 'object') return '';
  return String(value || '').trim();
}

/*
 * 作用：
 * 读取可选数字，并限制在安全范围内。
 */
function normalizeOptionalNumber(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return clamp(number, min, max);
}

/*
 * 作用：
 * 规范化布局类型。
 *
 * 关键点：
 * layout 是配置区里的标量值，例如 layout: mindmap-left。
 * 这里不接收旧的嵌套布局配置，也不接收 right/left 这类短名，
 * 避免未发布阶段留下两套配置结构。
 */
function normalizeLayoutType(value) {
  const text = normalizeText(value).toLowerCase();
  if (
    [
      'mindmap-right',
      'mindmap-left',
      'mindmap-bidirectional',
      'mindmap-down',
      'mindmap-up',
      'mindmap-vertical',
      'tree-right',
      'tree-left',
      'tree',
      'org',
      'org-right',
      'timeline-up',
      'timeline-down',
      'timeline',
      'radial',
      'fishbone-left',
      'tree-table',
      'tree-table-stepped',
    ].includes(text)
  ) {
    return text;
  }
  return '';
}

/*
 * 作用：
 * 规范化连线线型。
 */
function normalizeConnectorStyle(value) {
  const text = normalizeText(value).toLowerCase();
  if (text === 'curve' || text === 'straight' || text === 'elbow') return text;
  return '';
}

/*
 * 作用：
 * 规范化视图模式，只允许 map/source。
 */
function normalizeViewMode(value) {
  const text = normalizeText(value).toLowerCase();
  if (text === 'map' || text === 'source') return text;
  return '';
}
