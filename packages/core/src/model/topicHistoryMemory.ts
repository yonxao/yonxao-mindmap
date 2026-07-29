export const TOPIC_HISTORY_MEMORY_MAX_ENTRIES = 30;
export const TOPIC_HISTORY_MEMORY_MAX_BYTES = 16 * 1024 * 1024;
export const TOPIC_HISTORY_ENTRY_MAX_BYTES = 4 * 1024 * 1024;

export function trimTopicHistoryStacksForMemoryBudget(
  undoStack: string[],
  redoStack: string[]
): void {
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

export function topicHistoryStacksByteSize(
  undoStack: readonly unknown[],
  redoStack: readonly unknown[]
): number {
  return [...undoStack, ...redoStack].reduce<number>(
    (total, source) => total + topicHistorySnapshotByteSize(source),
    0
  );
}

export function topicHistorySnapshotByteSize(source: unknown): number {
  return String(source || '').length * 2;
}
