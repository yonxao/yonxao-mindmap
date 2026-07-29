/*
 * 插件兼容出口：宿主无关的主题树操作实现在 @yonxao/mindmap-core。
 */
export {
  cloneTopicSubtree,
  containsTopicId,
  countTopicDescendants,
  findTopicContext,
  insertSiblingTopic,
  moveTopicInTree,
  refreshTreeLevels,
  removeTopicById,
  setOptionalTopicAttribute,
} from '@yonxao/mindmap-core';
