/*
 * 插件兼容出口：宿主无关的历史快照容量预算实现在 @yonxao/mindmap-core。
 */
export {
  TOPIC_HISTORY_ENTRY_MAX_BYTES,
  TOPIC_HISTORY_MEMORY_MAX_BYTES,
  TOPIC_HISTORY_MEMORY_MAX_ENTRIES,
  topicHistorySnapshotByteSize,
  topicHistoryStacksByteSize,
  trimTopicHistoryStacksForMemoryBudget,
} from '@yonxao/mindmap-core';
