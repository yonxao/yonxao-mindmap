import { parseMindDocument as parseCoreMindDocument } from '@yonxao/mindmap-core';
import { canonicalizeMindConfig, normalizeMindConfig } from '../config/mindConfig.js';

/*
 * 文件作用：
 * 保留插件原有 parser 入口，并把宿主配置解析与公共 yxmm 主题语法组合起来。
 *
 * 公共核心负责完整文档语法；插件层只追加配置规范化结果。
 */
export function parseMindDocument(source) {
  const document = parseCoreMindDocument(source);
  const rawConfig = canonicalizeMindConfig(document.rawConfig);

  return {
    ...document,
    rawConfig,
    config: normalizeMindConfig(rawConfig),
  };
}

// 保持现有插件内部 import 路径稳定，迁移期间调用方无需一次性改写。
export {
  assignIds,
  buildRootFromRoots,
  createMindTopic,
  matchTopicLevelLine,
  parseTopicAttributes,
  parseTopicLine,
  parseTopicMind,
} from '@yonxao/mindmap-core';
