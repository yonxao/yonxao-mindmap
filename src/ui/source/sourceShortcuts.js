/*
 * 源码模式快捷键判断保持为纯函数，避免保存行为与 DOM/Obsidian 生命周期耦合后难以回归。
 */

const SOURCE_SAVE_SHORTCUT_CODE = 'KeyS';
const SOURCE_SAVE_SHORTCUT_KEY = 's';

export function isSourceSaveShortcut(event) {
  if (!event || event.isComposing) return false;
  const key = String(event.key || '').toLowerCase();
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    (event.code === SOURCE_SAVE_SHORTCUT_CODE || key === SOURCE_SAVE_SHORTCUT_KEY)
  );
}
