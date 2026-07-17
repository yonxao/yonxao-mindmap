/*
 * 文件作用：
 * 维护主题撤销历史在 session memory 中的容量预算。
 *
 * 设计边界：
 * 撤销/重做仍保存完整源码快照以保证恢复可靠性；本文件只负责按条目数和字节数裁剪旧快照。
 */

// 静态历史缓存按代码块维度保留，避免长时间会话打开大量文件后无界增长。
export const TOPIC_HISTORY_MEMORY_MAX_ENTRIES = 30;
// 撤销历史保存完整源码快照；用字节预算控制长期会话中的总内存占用。
export const TOPIC_HISTORY_MEMORY_MAX_BYTES = 16 * 1024 * 1024;
// 单个代码块历史也单独限额，避免一个超大导图挤占全部 session memory。
export const TOPIC_HISTORY_ENTRY_MAX_BYTES = 4 * 1024 * 1024;

export function trimTopicHistoryStacksForMemoryBudget(undoStack, redoStack) {
  let byteSize = topicHistoryStacksByteSize(undoStack, redoStack);
  while (byteSize > TOPIC_HISTORY_ENTRY_MAX_BYTES && undoStack.length > 1) {
    const removed = undoStack.shift();
    byteSize -= topicHistorySnapshotByteSize(removed);
  }

  while (byteSize > TOPIC_HISTORY_ENTRY_MAX_BYTES && redoStack.length > 1) {
    const removed = redoStack.shift();
    byteSize -= topicHistorySnapshotByteSize(removed);
  }
}

export function topicHistoryStacksByteSize(undoStack, redoStack) {
  return [...undoStack, ...redoStack].reduce(
    (total, source) => total + topicHistorySnapshotByteSize(source),
    0
  );
}

export function topicHistorySnapshotByteSize(source) {
  return String(source || '').length * 2;
}
