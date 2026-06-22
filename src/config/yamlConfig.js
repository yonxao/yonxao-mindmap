/*
 * 文件作用：
 * 解析和序列化插件配置使用的小型 YAML 子集。
 */

import { isPlainObject } from './configAccessors.js';

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
 * font/topic 下先输出全局字段，再输出 level1/2/3；每个 level 内也按固定字段排序。
 * 这样配置区读起来像“先全局、再局部覆盖”，不会出现 level 配置插在全局字段中间的情况。
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
    return ['basic', 'theme', 'layout', 'font'];
  }
  if (keyPath === 'basic') {
    return [
      'canvasHeight',
      'sourceHeight',
      'toolbar',
      'viewFit',
      'fitViewNoUpscale',
      'fitViewMaxScale',
      'tabIndent',
      'wheelZoom',
    ];
  }
  if (keyPath === 'basic.toolbar') return ['corner', 'placement'];
  if (keyPath === 'theme') return ['scheme', 'defaultTopicColor', 'buttonColorMode', 'buttonColor'];
  if (keyPath === 'layout') {
    return ['type', 'connectorStyle', 'branchExpansion', 'topicMaxWidth'];
  }
  if (keyPath === 'layout.topicMaxWidth') return ['global', 'level1', 'level2', 'level3'];
  if (keyPath === 'font') {
    return ['family', 'size', 'weight', 'lineHeight', 'level1', 'level2', 'level3'];
  }
  if (/^font\.level[123]$/.test(keyPath)) {
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
  if (quoted) {
    if (quoted[1] === "'") return quoted[2].replace(/''/g, "'");
    return quoted[2].replace(/\\"/g, '"').replace(/\\'/g, "'");
  }

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
    if (char === "'" && quote === "'" && line[index + 1] === "'") {
      index += 1;
      continue;
    }
    if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
      quote = quote === char ? '' : quote || char;
    }
    if (char === '#' && !quote && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index);
    }
  }

  return line;
}
