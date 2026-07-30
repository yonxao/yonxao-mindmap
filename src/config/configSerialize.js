/*
 * 插件兼容出口：配置区拆分、条件裁剪和源码拼接由公共核心维护。
 */

export {
  hasMeaningfulConfig,
  pruneInactiveMindConfig,
  serializeCanonicalMindSource as serializeMindSource,
  splitCanonicalMindSourceConfig as splitMindSourceConfig,
} from '@yonxao/mindmap-core';
