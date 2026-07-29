/*
 * 高级结构语法已经迁入宿主无关的公共核心。
 * 这里保留兼容导出，避免插件内部模块在第一阶段发生无关路径迁移。
 */
export {
  MIND_STRUCTURE_TYPES,
  RELATION_ANCHOR_ATTRIBUTES,
  RELATION_ANCHOR_NAMES,
  RELATION_DEFAULT_DIRECTION,
  RELATION_DEFAULT_LINE_STYLE,
  STRUCTURE_BLOCK_END,
  STRUCTURE_BLOCK_START,
  STRUCTURE_ID_PREFIXES,
  findTopicByStableId,
  parseMindStructures,
  serializeMindStructures,
  splitMindStructureBlock,
  validateMindStructures,
} from '@yonxao/mindmap-core';
