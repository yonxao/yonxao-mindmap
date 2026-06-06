/*
 * 文件作用：
 * 这里放普通 DOM 相关的小工具。
 *
 * 当前功能：
 * createLabeledField 用于节点编辑面板，把 label 文本和 input/select 组合成统一布局。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer.createNodeEditor() -> createLabeledField()
 */

/*
 * 作用：
 * 创建节点编辑面板中的“标题 + 输入控件”组合。
 */
export function createLabeledField(labelText, fieldEl) {
  const label = document.createElement('label');
  label.className = 'yonxao-mindmap-node-editor-field';

  const span = document.createElement('span');
  span.textContent = labelText;

  label.appendChild(span);
  label.appendChild(fieldEl);
  return label;
}
