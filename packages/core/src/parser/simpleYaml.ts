/*
 * 文件作用：
 * 解析和序列化 yxmm 配置区使用的小型 YAML 子集。
 */

export type RawMindConfig = Record<string, unknown>;

const YAML_INDENT_STEP = 2;
export const FONT_LEVEL_FIELD_KEYS = Object.freeze([
  'family',
  'size',
  'weight',
  'lineHeight',
] as const);
export const FONT_LEVEL_KEYS = Object.freeze(['level1', 'level2', 'level3'] as const);
export const WATERMARK_SIGNATURE_CONFIG_KEYS = Object.freeze([
  'style',
  'text',
  'position',
  'color',
  'backgroundColor',
  'fontSize',
  'opacity',
  'barHeight',
  'paddingX',
  'paddingY',
] as const);
export const WATERMARK_NORMAL_CONFIG_KEYS = Object.freeze([
  'type',
  'arrangement',
  'position',
  'text',
  'imageSourceType',
  'imageSource',
  'color',
  'fontSize',
  'opacity',
  'rotation',
  'width',
  'height',
  'gapX',
  'gapY',
  'offsetX',
  'offsetY',
] as const);

export function isPlainObject(value: unknown): value is RawMindConfig {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseSimpleYaml(lines: readonly string[]): RawMindConfig {
  const root: RawMindConfig = {};
  const stack: Array<{ indent: number; value: RawMindConfig }> = [{ indent: -1, value: root }];

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
      const child: RawMindConfig = {};
      parent[key] = child;
      stack.push({ indent, value: child });
    } else {
      parent[key] = parseYamlScalar(rawValue);
    }
  }

  return root;
}

export function stringifySimpleYaml(
  value: unknown,
  depth = 0,
  path: readonly string[] = []
): string {
  if (!isPlainObject(value)) return '';

  const indent = ' '.repeat(YAML_INDENT_STEP).repeat(depth);
  const lines: string[] = [];

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

function orderedConfigEntries(
  value: RawMindConfig,
  path: readonly string[]
): Array<[string, unknown]> {
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
 * 配置区顺序属于文档格式，不依赖具体宿主的设置面板实现。
 */
function configKeyOrder(path: readonly string[]): readonly string[] {
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
  if (keyPath === 'structure.topicMaxWidth') return ['global', ...FONT_LEVEL_KEYS];
  if (keyPath === 'color') {
    return ['scheme', 'defaultTopicColor', 'buttonColorMode', 'buttonColor', 'advancedStructure'];
  }
  if (keyPath === 'color.advancedStructure') return ['relation', 'summary', 'boundary'];
  if (keyPath === 'font') {
    return [...FONT_LEVEL_FIELD_KEYS, 'align', ...FONT_LEVEL_KEYS];
  }
  if (/^font\.level[123]$/.test(keyPath)) {
    return FONT_LEVEL_FIELD_KEYS;
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

function parseYamlScalar(value: string): string | number | boolean {
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);

  const quoted = value.match(/^(['"])(.*)\1$/);
  if (quoted) {
    if (quoted[1] === "'") return quoted[2].replace(/''/g, "'");
    return quoted[2].replace(/\\"/g, '"').replace(/\\'/g, "'");
  }

  return value;
}

function stringifyYamlScalar(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = String(value || '');
  if (/^[a-zA-Z0-9_./-]+$/.test(text)) return text;
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function stripYamlComment(line: string): string {
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
