/*
 * 文件作用：
 * 管理只服务于当前 Obsidian 会话的短期内存缓存。
 *
 * 设计边界：
 * 这些缓存只用于跨代码块重建恢复 UI 状态，不做持久化；通过 TTL、LRU 和容量预算防止
 * 长时间会话中静态 Map 无界增长。
 */

export function getSessionMemory(map, key, options = {}) {
  const now = options.now ?? Date.now();
  sweepSessionMemory(map, { now });

  const record = map.get(key);
  if (!record) return null;

  if (isExpiredSessionRecord(record, now)) {
    map.delete(key);
    return null;
  }

  record.lastAccessedAt = now;
  return record.value;
}

export function setSessionMemory(map, key, value, options = {}) {
  const now = options.now ?? Date.now();
  const ttlMs = Math.max(0, Number(options.ttlMs) || 0);
  const byteSize =
    Number.isFinite(options.byteSize) && options.byteSize >= 0
      ? Math.ceil(options.byteSize)
      : estimateSessionValueBytes(value);

  map.set(key, {
    value,
    expiresAt: now + ttlMs,
    lastAccessedAt: now,
    byteSize,
  });

  sweepSessionMemory(map, {
    now,
    maxEntries: options.maxEntries,
    maxBytes: options.maxBytes,
    protectedKey: key,
  });
}

export function deleteSessionMemory(map, key) {
  map.delete(key);
}

export function sweepSessionMemory(map, options = {}) {
  const now = options.now ?? Date.now();

  for (const [key, record] of map) {
    if (isExpiredSessionRecord(record, now)) {
      map.delete(key);
    }
  }

  const maxEntries = Number.isFinite(options.maxEntries) ? Math.max(0, options.maxEntries) : null;
  const maxBytes = Number.isFinite(options.maxBytes) ? Math.max(0, options.maxBytes) : null;
  if (maxEntries === null && maxBytes === null) return;

  let totalBytes = 0;
  for (const record of map.values()) {
    totalBytes += sessionRecordByteSize(record);
  }

  while (
    map.size > 0 &&
    ((maxEntries !== null && map.size > maxEntries) || (maxBytes !== null && totalBytes > maxBytes))
  ) {
    const oldestKey = oldestSessionMemoryKey(map, { protectedKey: options.protectedKey });
    if (oldestKey === undefined) break;

    const record = map.get(oldestKey);
    totalBytes -= sessionRecordByteSize(record);
    map.delete(oldestKey);
  }
}

export function estimateSessionValueBytes(value) {
  if (typeof value === 'string') return value.length * 2;
  if (typeof value === 'number' || typeof value === 'boolean') return 8;
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + estimateSessionValueBytes(item), 0);
  }
  if (typeof value === 'object') {
    return Object.values(value).reduce((sum, item) => sum + estimateSessionValueBytes(item), 0);
  }
  return 0;
}

function isExpiredSessionRecord(record, now) {
  return !record || !Number.isFinite(record.expiresAt) || record.expiresAt <= now;
}

function sessionRecordByteSize(record) {
  return Number.isFinite(record?.byteSize) ? Math.max(0, record.byteSize) : 0;
}

function oldestSessionMemoryKey(map, options = {}) {
  let oldestKey;
  let oldestAccessedAt = Infinity;
  const protectedKey = options.protectedKey;

  for (const [key, record] of map) {
    if (protectedKey !== undefined && key === protectedKey) continue;

    const lastAccessedAt = Number.isFinite(record?.lastAccessedAt) ? record.lastAccessedAt : 0;
    if (lastAccessedAt < oldestAccessedAt) {
      oldestKey = key;
      oldestAccessedAt = lastAccessedAt;
    }
  }

  return oldestKey;
}

/*
 * 根据代码块的 Obsidian 上下文信息生成唯一的缓存键后缀。
 *
 * 优先级：行号定位 > 编辑器偏移定位 > 源码前 N 字符 fallback。
 * 行号定位最精确，编辑器定位用于没有 sectionInfo 的编辑上下文，
 * 源码 fallback 用于跨保存重建时的兜底。
 */
export function codeBlockMemoryKey(ctx, hostEl, editorContext, source, truncateLength = 64) {
  const sourcePath = ctx?.sourcePath || 'unknown';
  const sectionInfo =
    ctx && typeof ctx.getSectionInfo === 'function' ? ctx.getSectionInfo(hostEl) : null;

  if (sectionInfo) {
    return `${sourcePath}:${sectionInfo.lineStart}`;
  }

  if (editorContext && Number.isFinite(editorContext.contentFrom)) {
    return `${sourcePath}:editor:${editorContext.contentFrom}`;
  }

  return `${sourcePath}:${String(source || '').slice(0, truncateLength)}`;
}
