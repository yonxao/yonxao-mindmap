/*
 * 插件兼容出口：文档配置访问、克隆和来源合并规则由公共核心维护。
 */

export {
  clonePlainObject,
  deepMergePlainObjects,
  deleteMindConfigPath,
  isPlainObject,
  mergeMindConfigObjects,
  mergeMindConfigSources,
  setConfigValueIfPresent,
  setMindConfigPath,
} from '@yonxao/mindmap-core';
