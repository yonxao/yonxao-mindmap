/*
 * 文件作用：
 * 这里保存对思维导图树进行修改的小型业务操作。
 *
 * 当前功能：
 * - setOptionalAttr：设置可选属性，空值时删除属性，避免序列化出 color= 这样的无意义内容。
 * - removeNodeById：递归查找并删除指定节点。
 * - findNodeContext：查找节点及其父节点、所在下标，供“添加兄弟节点”等操作使用。
 * - insertSiblingNode：在目标节点前后插入同级节点。
 * - moveNodeInTree：拖拽节点后移动节点到新的父子或兄弟位置。
 * - containsNodeId：判断一个节点是否包含指定后代，避免拖拽产生循环树。
 * - refreshTreeLevels：结构移动后刷新节点 level，确保布局和字号按新层级生效。
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
 * 判断 parentNode 的子树里是否包含 targetId。
 *
 * 调用场景：
 * 节点拖拽时不能把父节点拖到自己的子节点下面，否则树会形成循环结构，序列化和布局都会出错。
 */
export function containsNodeId(parentNode, targetId) {
  if (!parentNode || !parentNode.children.length) return false;

  for (const child of parentNode.children) {
    if (child.id === targetId || containsNodeId(child, targetId)) {
      return true;
    }
  }

  return false;
}

/*
 * 作用：
 * 根据拖拽结果移动节点。
 *
 * placement 说明：
 * - child：把移动节点放到目标节点最后一个子节点位置。
 * - before：把移动节点插入到目标节点上方，也就是目标节点前一个兄弟位置。
 * - after：把移动节点插入到目标节点下方，也就是目标节点后一个兄弟位置。
 *
 * 实现逻辑：
 * 1. 先在旧位置移除移动节点。
 * 2. 再重新查找目标节点。这样同父级移动时，目标下标会自动变成移除后的正确值。
 * 3. 插入完成后刷新整棵树的 level，避免层级移动后字号和序列化语义错乱。
 */
export function moveNodeInTree(root, movingId, targetId, placement) {
  const movingContext = findNodeContext(root, movingId);
  if (!movingContext || !movingContext.parent || movingContext.index < 0) return false;
  if (movingId === targetId || containsNodeId(movingContext.node, targetId)) return false;

  const movingNode = movingContext.node;
  movingContext.parent.children.splice(movingContext.index, 1);

  if (placement === 'child') {
    const targetContext = findNodeContext(root, targetId);
    if (!targetContext || !targetContext.node) {
      movingContext.parent.children.splice(movingContext.index, 0, movingNode);
      return false;
    }

    targetContext.node.children.push(movingNode);
    refreshTreeLevels(root);
    return true;
  }

  const targetContext = findNodeContext(root, targetId);
  if (!targetContext || !targetContext.parent || targetContext.index < 0) {
    movingContext.parent.children.splice(movingContext.index, 0, movingNode);
    return false;
  }

  const insertIndex = placement === 'before' ? targetContext.index : targetContext.index + 1;
  targetContext.parent.children.splice(insertIndex, 0, movingNode);
  refreshTreeLevels(root);
  return true;
}

/*
 * 作用：
 * 按当前树结构重新计算每个节点的 Markdown 标题层级。
 *
 * 技术点：
 * 普通文档根节点是 level=1；多根文档会有一个虚拟根，虚拟根 level=0，
 * 它的孩子才是 Markdown 里的一级标题。
 */
export function refreshTreeLevels(root, level = root && root._virtual ? 0 : 1) {
  if (!root) return;

  root.level = level;
  for (const child of root.children) {
    refreshTreeLevels(child, level + 1);
  }
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
