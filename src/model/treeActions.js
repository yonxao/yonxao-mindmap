/*
 * 文件作用：
 * 这里保存对思维导图树进行修改的小型业务操作。
 *
 * 当前功能：
 * - setOptionalAttr：设置可选属性，空值时删除属性，避免序列化出 color= 这样的无意义内容。
 * - removeNodeById：递归查找并删除指定节点。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer 的节点编辑面板 -> treeActions -> serializeMind -> 保存回 Markdown
 */

/*
 * 作用：
 * 设置节点可选属性；当值为空时删除该属性。
 *
 * 调用链：
 * Renderer.saveNodeEditor() -> setOptionalAttr()。
 */
export function setOptionalAttr(attrs, key, value) {
  const normalized = String(value || '').trim();
  if (normalized) {
    attrs[key] = normalized;
  } else {
    delete attrs[key];
  }
}

/*
 * 作用：
 * 从树中递归删除指定 id 的节点。
 *
 * 实现逻辑：
 * 在父节点 children 数组中找到目标后 splice 删除，并返回 true 终止递归。
 */
export function removeNodeById(root, id) {
  // 删除节点时从父节点的 children 数组里移除。
  // 这里用递归查找，因为思维导图天然就是树结构。
  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (child.id === id) {
      root.children.splice(index, 1);
      return true;
    }

    if (removeNodeById(child, id)) return true;
  }

  return false;
}
