/*
 * 作用：
 * 解析和序列化插件配置使用的小型 YAML 子集。
 *
 * 协作说明：
 * 解析流程：parseSimpleYaml 先逐行调用 stripYamlComment 移除行内注释（# 到行尾），
 * 再交给 parseYamlScalar 解析标量值。引号内的 # 由 stripYamlComment 保证不被误删。
 * stringifyYamlScalar 序列化时，对包含 # 的字符串（如 hex 颜色值）自动加引号，
 * 避免下次解析时被当成注释。
 */

import { isPlainObject } from './configAccessors.js';
import {
  WATERMARK_NORMAL_CONFIG_KEYS,
  WATERMARK_SIGNATURE_CONFIG_KEYS,
} from './defaultMindConfig.js';

// YAML 缩进步长固定为 2 个空格，符合常见 Obsidian 配置区书写习惯
const YAML_INDENT_STEP = 2;

export function parseSimpleYaml(lines) {
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (const rawLine of lines) {
    const withoutComment = stripYamlComment(rawLine);
    if (!withoutComment.trim()) continue;

    const indent = withoutComment.match(/^ */)?.[0].length || 0;
    if (indent % YAML_INDENT_STEP !== 0) {
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

  const indent = ' '.repeat(YAML_INDENT_STEP).repeat(depth);
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
 * 配置区按配置面板心智排序；font/structure.topicMaxWidth 下先输出全局字段，
 * 再输出 level1/2/3。这样配置区读起来像“先全局、再局部覆盖”。
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
    return ['display', 'structure', 'color', 'font', 'interaction', 'watermark'];
  }
  if (keyPath === 'display') {
    return ['canvasHeight', 'sourceHeight', 'viewFit', 'fitViewNoUpscale', 'fitViewMaxScale'];
  }
  if (keyPath === 'structure') {
    return ['layout', 'connectorStyle', 'branchExpansion', 'topicMaxWidth'];
  }
  if (keyPath === 'structure.topicMaxWidth') return ['global', 'level1', 'level2', 'level3'];
  if (keyPath === 'color') {
    // advancedStructure 放在最后，表示它是配色区的扩展子段，与基础配色项不重叠。
    return ['scheme', 'defaultTopicColor', 'buttonColorMode', 'buttonColor', 'advancedStructure'];
  }
  if (keyPath === 'color.advancedStructure') return ['relation', 'summary', 'boundary'];
  if (keyPath === 'font') {
    return ['family', 'size', 'weight', 'lineHeight', 'align', 'level1', 'level2', 'level3'];
  }
  if (/^font\.level[123]$/.test(keyPath)) {
    return ['family', 'size', 'weight', 'lineHeight'];
  }
  if (keyPath === 'interaction') {
    return ['toolbar', 'topicControlVisibility', 'wheelZoom', 'tabIndent'];
  }
  if (keyPath === 'interaction.toolbar') return ['corner', 'placement'];
  if (keyPath === 'watermark') return ['enabled', 'mode', 'signature', 'normal'];
  if (keyPath === 'watermark.signature') return WATERMARK_SIGNATURE_CONFIG_KEYS;
  if (keyPath === 'watermark.normal') return WATERMARK_NORMAL_CONFIG_KEYS;
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
