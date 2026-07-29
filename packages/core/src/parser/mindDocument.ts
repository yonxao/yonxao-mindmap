/*
 * 文件作用：
 * 组合配置前置区、主题树和高级结构，提供宿主无关的完整 yxmm 文档读写入口。
 */

import {
  serializeMindStructures,
  splitMindStructureBlock,
  validateMindStructures,
} from './mindStructures.js';
import { parseSimpleYaml, stringifySimpleYaml } from './simpleYaml.js';
import type { RawMindConfig } from './simpleYaml.js';
import { parseTopicMind } from './topicParser.js';
import { serializeMind } from '../serializer/topicSerializer.js';
import type { MindStructure, MindTopic } from '../model/types.js';

const YAML_DELIMITER = '---';

export interface MindSourceConfig {
  hasConfig: boolean;
  rawConfig: RawMindConfig;
  body: string;
}

export interface ParsedMindDocument extends MindSourceConfig {
  root: MindTopic | null;
  structures: MindStructure[];
}

export interface SerializeMindDocumentOptions {
  rawConfig?: RawMindConfig;
  forceConfig?: boolean;
  structures?: readonly MindStructure[];
  saveFullConfig?: boolean;
}

export function splitMindSourceConfig(source: unknown): MindSourceConfig {
  const text = String(source || '');
  const lines = text.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim() !== '');

  if (firstContentIndex === -1 || lines[firstContentIndex].trim() !== YAML_DELIMITER) {
    return {
      hasConfig: false,
      rawConfig: {},
      body: text,
    };
  }

  const endIndex = lines.findIndex(
    (line, index) => index > firstContentIndex && line.trim() === YAML_DELIMITER
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

export function serializeMindSource(
  rawConfig: RawMindConfig | null | undefined,
  body: unknown,
  forceConfig = false
): string {
  const config = rawConfig || {};
  const bodyText = String(body || '').trim();
  const shouldWriteConfig = forceConfig || hasMeaningfulConfig(config);

  if (!shouldWriteConfig) return bodyText;

  const configText = stringifySimpleYaml(config);
  return [YAML_DELIMITER, configText, YAML_DELIMITER, '', bodyText].join('\n').trimEnd();
}

export function parseMindDocument(source: unknown): ParsedMindDocument {
  const document = splitMindSourceConfig(source);
  const structureDocument = splitMindStructureBlock(document.body);
  const root = parseTopicMind(structureDocument.topicBody.split(/\r?\n/));
  validateMindStructures(root, structureDocument.structures);

  return {
    ...document,
    root,
    structures: structureDocument.structures,
  };
}

export function serializeMindDocument(
  root: MindTopic,
  options: SerializeMindDocumentOptions = {}
): string {
  const body = [
    serializeMind(root),
    serializeMindStructures(options.structures, {
      saveFullConfig: options.saveFullConfig === true,
    }),
  ]
    .filter(Boolean)
    .join('\n\n');

  return serializeMindSource(options.rawConfig, body, options.forceConfig);
}

export function hasMeaningfulConfig(config: unknown): boolean {
  return (
    config !== null &&
    typeof config === 'object' &&
    !Array.isArray(config) &&
    Object.keys(config).length > 0
  );
}
