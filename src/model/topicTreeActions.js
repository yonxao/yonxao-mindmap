/*
 * 文件作用：
 * 这里保存对思维导图树进行修改的小型业务操作。
 *
 * 当前功能：
 * - setOptionalAttr：设置可选属性，空值时删除属性，避免序列化出 color= 这样的无意义内容。
 * - removeTopicById：递归查找并删除指定主题。
 * - findTopicContext：查找主题及其父主题、所在下标，供“添加兄弟主题”等操作使用。
 * - insertSiblingTopic：在目标主题前后插入同级主题。
 * - moveTopicInTree：拖拽主题后移动主题到新的父子或兄弟位置。
 * - containsTopicId：判断一个主题是否包含指定后代，避免拖拽产生循环树。
 * - refreshTreeLevels：结构移动后刷新主题 level，确保布局和字号按新层级生效。
 * - countTopicDescendants：统计一个主题下面共有多少后代主题。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer 的主题编辑面板 -> topicTreeActions -> serializeMind -> 保存回 Markdown
 */

/*
 * 作用：
 * 设置主题可选属性；当值为空时删除该属性。
 *
 * 调用链：
 * Renderer.saveTopicEditor() -> setOptionalAttr()。
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
 * 从树中递归删除指定 id 的主题。
 *
 * 实现逻辑：
 * 在父主题 children 数组中找到目标后 splice 删除，并返回 true 终止递归。
 */
export function removeTopicById(root, id) {
  // 删除主题时从父主题的 children 数组里移除。
  // 这里用递归查找，因为思维导图天然就是树结构。
  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (child.id === id) {
      root.children.splice(index, 1);
      return true;
    }

    if (removeTopicById(child, id)) return true;
  }

  return false;
}

/*
 * 作用：
 * 在树里查找指定主题，并返回它的父主题和兄弟数组下标。
 *
 * 为什么需要父主题：
 * “添加兄弟主题”不能只知道当前主题本身，还必须知道当前主题在父主题 children
 * 数组里的位置，才能准确插入到它的上方或下方。
 *
 * 调用链：
 * Renderer.addSiblingFromContextMenu() -> findTopicContext()/insertSiblingTopic()。
 */
export function findTopicContext(root, id, parent = null) {
  if (!root) return null;
  if (root.id === id) {
    return {
      topic: root,
      parent,
      index: -1,
    };
  }

  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (child.id === id) {
      return {
        topic: child,
        parent: root,
        index,
      };
    }

    const found = findTopicContext(child, id, child);
    if (found) return found;
  }

  return null;
}

/*
 * 作用：
 * 在指定主题的上方或下方插入一个兄弟主题。
 *
 * 实现逻辑：
 * 先用 findTopicContext 找到父主题和下标，再用 splice 修改父主题 children。
 * 这里不负责 assignIds 和保存，调用方会在完成业务操作后统一序列化。
 */
export function insertSiblingTopic(root, targetId, sibling, position = 'after') {
  const context = findTopicContext(root, targetId);
  if (!context || !context.parent || context.index < 0) return false;

  const insertIndex = position === 'before' ? context.index : context.index + 1;
  context.parent.children.splice(insertIndex, 0, sibling);
  return true;
}

/*
 * 作用：
 * 判断 parentTopic 的子树里是否包含 targetId。
 *
 * 调用场景：
 * 主题拖拽时不能把父主题拖到自己的子主题下面，否则树会形成循环结构，序列化和布局都会出错。
 */
export function containsTopicId(parentTopic, targetId) {
  if (!parentTopic || !parentTopic.children.length) return false;

  for (const child of parentTopic.children) {
    if (child.id === targetId || containsTopicId(child, targetId)) {
      return true;
    }
  }

  return false;
}

/*
 * 作用：
 * 根据拖拽结果移动主题。
 *
 * placement 说明：
 * - child：把移动主题放到目标主题最后一个子主题位置。
 * - before：把移动主题插入到目标主题上方，也就是目标主题前一个兄弟位置。
 * - after：把移动主题插入到目标主题下方，也就是目标主题后一个兄弟位置。
 *
 * 实现逻辑：
 * 1. 先在旧位置移除移动主题。
 * 2. 再重新查找目标主题。这样同父级移动时，目标下标会自动变成移除后的正确值。
 * 3. 插入完成后刷新整棵树的 level，避免层级移动后字号和序列化语义错乱。
 */
export function moveTopicInTree(root, movingTopicId, targetId, placement) {
  const movingTopicContext = findTopicContext(root, movingTopicId);
  if (!movingTopicContext || !movingTopicContext.parent || movingTopicContext.index < 0) {
    return false;
  }
  if (movingTopicId === targetId || containsTopicId(movingTopicContext.topic, targetId)) {
    return false;
  }

  const movingTopic = movingTopicContext.topic;
  movingTopicContext.parent.children.splice(movingTopicContext.index, 1);

  if (placement === 'child') {
    const targetTopicContext = findTopicContext(root, targetId);
    if (!targetTopicContext || !targetTopicContext.topic) {
      movingTopicContext.parent.children.splice(movingTopicContext.index, 0, movingTopic);
      return false;
    }

    targetTopicContext.topic.children.push(movingTopic);
    refreshTreeLevels(root);
    return true;
  }

  const targetTopicContext = findTopicContext(root, targetId);
  if (!targetTopicContext || !targetTopicContext.parent || targetTopicContext.index < 0) {
    movingTopicContext.parent.children.splice(movingTopicContext.index, 0, movingTopic);
    return false;
  }

  const insertIndex =
    placement === 'before' ? targetTopicContext.index : targetTopicContext.index + 1;
  targetTopicContext.parent.children.splice(insertIndex, 0, movingTopic);
  refreshTreeLevels(root);
  return true;
}

/*
 * 作用：
 * 按当前树结构重新计算每个主题的 主题级别标记层级。
 *
 * 技术点：
 * 普通文档根主题是 level=1；多根文档会有一个虚拟根，虚拟根 level=0，
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
 * 统计主题的所有后代数量。
 *
 * 调用场景：
 * 删除带子主题的分支前，用这个数量给用户一个明确确认提示。
 */
export function countTopicDescendants(topic) {
  if (!topic || !topic.children.length) return 0;

  return topic.children.reduce((total, child) => total + 1 + countTopicDescendants(child), 0);
}
