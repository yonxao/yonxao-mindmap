import { serializeMindDocument as serializeCoreMindDocument } from '@yonxao/mindmap-core';
import {
  mergeMindConfigSources,
  normalizeMindConfig,
  pruneInactiveMindConfig,
} from '../config/mindConfig.js';

/*
 * 文件作用：
 * 保留插件原有 serializer 入口；插件层计算配置保存策略后交给公共核心写出完整文档。
 */
export function serializeMindDocument(root, rawConfig, forceConfig, baseConfig, structures = []) {
  const effectiveConfig = normalizeMindConfig(mergeMindConfigSources(baseConfig, rawConfig));
  const config = pruneInactiveMindConfig(rawConfig, baseConfig);
  return serializeCoreMindDocument(root, {
    rawConfig: config,
    forceConfig,
    structures,
    saveFullConfig: effectiveConfig.view.saveFullConfig,
  });
}

// 保持现有插件内部 import 路径稳定，迁移期间调用方无需一次性改写。
export {
  serializeMind,
  serializeTopic,
  serializeTopicAttributes,
  serializeTopicAttributeValue,
} from '@yonxao/mindmap-core';
