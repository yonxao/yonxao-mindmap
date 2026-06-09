/*
 * 文件作用：
 * 这里保存对思维导图树进行修改的小型业务操作。
 *
 * 当前功能：
 * - setOptionalAttr：设置可选属性，空值时删除属性，避免序列化出 color= 这样的无意义内容。
 * - removeNodeById：递归查找并删除指定节点。
 * - findNodeContext：查找节点及其父节点、所在下标，供“添加兄弟节点”等操作使用。
 * - insertSiblingNode：在目标节点前后插入同级节点。
 * - countDescendants：统计一个节点下面共有多少后代节点。
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

/*
 * 作用：
 * 在树里查找指定节点，并返回它的父节点和兄弟数组下标。
 *
 * 为什么需要父节点：
 * “添加兄弟节点”不能只知道当前节点本身，还必须知道当前节点在父节点 children
 * 数组里的位置，才能准确插入到它的上方或下方。
 *
 * 调用链：
 * Renderer.addSiblingFromContextMenu() -> findNodeContext()/insertSiblingNode()。
 */
export function findNodeContext(root, id, parent = null) {
  if (!root) return null;
  if (root.id === id) {
    return {
      node: root,
      parent,
      index: -1,
    };
  }

  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (child.id === id) {
      return {
        node: child,
        parent: root,
        index,
      };
    }

    const found = findNodeContext(child, id, child);
    if (found) return found;
  }

  return null;
}

/*
 * 作用：
 * 在指定节点的上方或下方插入一个兄弟节点。
 *
 * 实现逻辑：
 * 先用 findNodeContext 找到父节点和下标，再用 splice 修改父节点 children。
 * 这里不负责 assignIds 和保存，调用方会在完成业务操作后统一序列化。
 */
export function insertSiblingNode(root, targetId, sibling, position = 'after') {
  const context = findNodeContext(root, targetId);
  if (!context || !context.parent || context.index < 0) return false;

  const insertIndex = position === 'before' ? context.index : context.index + 1;
  context.parent.children.splice(insertIndex, 0, sibling);
  return true;
}

/*
 * 作用：
 * 统计节点的所有后代数量。
 *
 * 调用场景：
 * 删除带子节点的分支前，用这个数量给用户一个明确确认提示。
 */
export function countDescendants(node) {
  if (!node || !node.children.length) return 0;

  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}
