# yonxao-mindmap 布局回归样例集合

这个文件用于人工回归测试。建议把本文件放进 Obsidian 测试库中，分别在 Live Preview、
阅读视图、浅色主题、深色主题下检查。

每个布局都包含三类样例：

- 小图：检查基础渲染、按钮和主干方向。
- 中图：检查多层主题、折叠按钮、空间利用率。
- 长文本图：检查多行文本、最大宽度、字体和边距。

## 高级结构专项：功能列表

### 完整渲染与源码样例

用于检查关联、概要、外框同时存在时的图层、布局、配色、文字换行、适配视图和导出范围。

```yxmm
---
display:
  viewFit: fit
  saveFullConfig: false
structure:
  layout: mindmap-right
color:
  advancedStructure:
    relation: "#526b8a"
    summary: "#705b8f"
    boundary: "#477970"
---

# 功能列表 [id=t-100]
## 高级结构 [id=t-101]
### 关联 [id=t-102]
#### 曲线
#### 直线
#### 折线
### 概要 [id=t-103]
#### 多选主题
#### 多行文字
### 外框 [id=t-104]
#### 标题选项卡
#### 布局避让
## 其他能力 [id=t-105]
### 水印 [id=t-106]
### 导出 [id=t-107]

@structures
@relation [id=r-101 from=t-102 to=t-105 text="跨分支\n关联"]
@summary [id=s-101 topics=t-102,t-103 text="高级结构\n归纳"]
@boundary [id=b-101 topics=t-104 text="内容能力"]
@end
```

预期：

- 三种主体线默认透明度一致，颜色可区分；概要文字框和外框标题保持清晰。
- 关联位于概要上层，点击关联任意位置可以选中；选中曲线后出现两个可拖动控制点。
- 拖动控制点时，曲线和“跨分支 / 关联”文字同步移动，控制点经过概要时仍可操作。
- 概要位于“关联、概要”及其可见子主题之后，多行文字外框完整包裹内容。
- 外框包含“外框”及其可见子主题，左上角标题与上方主题保留间距，不覆盖其他主题。
- 点击适配视图、原始大小、复制图片和导出图片时，高级结构及标题不被裁切；导出结果不包含焦点、透明命中线和控制点。
- 源码模式对 `@structures`、结构类型、属性名、ID 和属性值显示基础高亮。

### 概要和外框交互创建样例

先粘贴以下无高级结构版本，再在导图模式中完成创建：

```yxmm
# 功能列表
## 编辑能力
### 新增主题
#### 新增子主题
### 删除主题
#### 删除子主题
### 修改主题
## 导出能力
### 导出图片
### 复制图片
## 其他能力
### 水印
```

操作步骤：

1. 右键“新增主题”创建概要，继续选择“删除主题”。操作条应显示已选数量和“选择有效”，按钮为“取消 / 创建”。
2. 拖动操作条文字区域，将其移到画布其他位置；原操作条下方的主题应可继续选择，完整提示不能截断。
3. 再选择“导出图片”，操作条应提示不是同一父主题；取消该主题后恢复有效。按 `Enter` 创建概要。
4. 右键“修改主题”创建外框。操作条初始即可创建，也可继续选择其他主题；按 `Esc` 取消后不残留高亮。
5. 再次创建外框并点击“创建”，确认外框包含所选主题及其可见子树，标题固定在左上角外侧。
6. 分别在窗口全屏和物理全屏中重复概要多选、拖动操作条、创建和取消。
7. 右键“编辑能力”创建关联，再点击“导出能力”；设置框默认方向应为正向、线型应为曲线。
8. 保存后进入源码模式：裁剪保存应省略 `direction=forward` 和 `lineStyle=curve`。在配置面板开启“保存全部配置项”并保存后，两项应完整写出。
9. 在配色选项卡分别修改关联、概要和外框颜色，确认代码块配置覆盖全局配置，结构自身 `color` 属性优先级最高。

## 连线线型与下挂展开专项

### 曲线连线

```yxmm
---
color:
  buttonColorMode: topic
---

# 曲线连线
## 一级分支
### 普通主题一
#### 下级主题一
#### 下级主题二
### 普通主题二
## 第二分支
### 侧向内容
```

### 直线连线

```yxmm
---
structure:
  connectorStyle: straight
color:
  scheme: forest
---

# 直线连线
## 一级分支
### 普通主题一
#### 下级主题一
#### 下级主题二
### 普通主题二
## 第二分支
### 侧向内容
```

### 折线连线与侧向展开

```yxmm
---
structure:
  connectorStyle: elbow
color:
  scheme: neon-rainbow
---

# 折线下挂
## 一级分支
### 普通主题一
#### 下挂主题一
#### 下挂主题二
### 普通主题二
#### 下挂主题三
#### 下挂主题四
## 第二分支
### 普通主题三
```

### 折线连线与下挂展开

```yxmm
---
structure:
  connectorStyle: elbow
  branchExpansion: hanging
color:
  scheme: neon-rainbow
---

# 折线下挂
## 一级分支
### 普通主题一
#### 下挂主题一
#### 下挂主题二
### 普通主题二
#### 下挂主题三
#### 下挂主题四
## 第二分支
### 普通主题三
```

## mindmap-right

### 小图

```yxmm
---
color:
  scheme: ocean
---

# 右向小图
## 基础
## 操作系统
```

### 中图

```yxmm
---
structure:
  connectorStyle: elbow
  branchExpansion: hanging
color:
  scheme: ocean
---

# 右向中图
## 基础
### 网络
### 操作系统
#### 进程
#### 文件系统
### 数据结构
## AI 框架
### Transformer
### RAG
#### 向量库
#### 检索增强
## 工具链
```

### 长文本图

```yxmm
---
structure:
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 320
color:
  scheme: ocean
font:
  lineHeight: 22
---

# 右向长文本
## 多行主题 [maxWidth=360]
第一行内容用于检查主题框宽度。
第二行内容用于检查真实换行是否保留。
### 这是一个很长的普通主题，用来检查中文自动折行和主题最大宽度是否稳定
#### 更深层级的长文本主题，应该下挂展开并保持紧凑
## 另一个分支
### 英文 mixed content with spaces should wrap by words when it is mostly latin text
```

## mindmap-left

### 小图

```yxmm
---
structure:
  layout: mindmap-left
color:
  scheme: forest
---

# 左向小图
## 基础
## 操作系统
```

### 中图

```yxmm
---
structure:
  layout: mindmap-left
  connectorStyle: elbow
  branchExpansion: hanging
color:
  scheme: forest
---

# 左向中图
## 基础
### 网络
### 操作系统
#### 进程
#### 文件系统
### 数据结构
## AI 框架
### Transformer
### RAG
#### 向量库
#### 检索增强
## 工具链
```

### 长文本图

```yxmm
---
structure:
  layout: mindmap-left
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 320
color:
  scheme: forest
font:
  size: 16
  lineHeight: 22
---

# 左向长文本
## 多行主题 [maxWidth=360]
第一行内容用于检查左向布局的主题宽度。
第二行内容用于检查折叠按钮是否靠近子线出口。
### 这是一个很长的普通主题，用来检查向左展开时中文自动折行是否稳定
#### 更深层级的长文本主题，应该下挂展开并保持紧凑
## 另一个分支
### English mixed content with spaces should wrap by words when it is mostly latin text
```

## mindmap-bidirectional

### 小图

```yxmm
---
structure:
  layout: mindmap-bidirectional
color:
  scheme: pastel-rainbow
---

# 双向小图
## 左右分配一
## 左右分配二
## 左右分配三
```

### 中图

```yxmm
---
structure:
  layout: mindmap-bidirectional
  connectorStyle: elbow
  branchExpansion: hanging
color:
  scheme: pastel-rainbow
---

# 双向中图
## 左侧知识
### 网络
### 操作系统
#### 进程
#### 文件系统
## 右侧实践
### Transformer
### RAG
#### 向量库
#### 检索增强
## 复盘
### 输出
```

### 长文本图

```yxmm
---
structure:
  layout: mindmap-bidirectional
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: pastel-rainbow
font:
  lineHeight: 22
---

# 双向长文本
## 左侧多行主题 [maxWidth=360]
第一行检查左侧长文本。
第二行检查左侧真实换行。
### 这是一个很长的普通主题，用来检查双向布局左侧折行
## 右侧多行主题 [maxWidth=360]
第一行检查右侧长文本。
第二行检查右侧真实换行。
### 这是一个很长的普通主题，用来检查双向布局右侧折行
```

## mindmap-down

### 小图

```yxmm
---
structure:
  layout: mindmap-down
color:
  scheme: sunset
---

# 下向小图
## 基础
## 操作系统
```

### 中图

```yxmm
---
structure:
  layout: mindmap-down
  connectorStyle: elbow
  branchExpansion: hanging
color:
  scheme: sunset
---

# 下向中图
## 基础
### 网络
### 操作系统
#### 进程
#### 文件系统
## AI 框架
### Transformer
### RAG
#### 向量库
#### 检索增强
## 工具链
```

### 长文本图

```yxmm
---
structure:
  layout: mindmap-down
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
color:
  scheme: sunset
font:
  size: 16
  lineHeight: 22
---

# 下向长文本
## 多行主题 [maxWidth=360]
第一行内容用于检查下向布局。
第二行内容用于检查水平占位。
### 这是一个很长的普通主题，用来检查向下展开时横向空间是否节省
#### 更深层级的长文本主题
## 另一个分支
### English mixed content with spaces should wrap by words
```

## mindmap-up

### 小图

```yxmm
---
structure:
  layout: mindmap-up
---

# 上向小图
## 基础
## 操作系统
```

### 中图

```yxmm
---
structure:
  layout: mindmap-up
  connectorStyle: elbow
  branchExpansion: hanging
color:
  buttonColorMode: topic
---

# 上向中图
## 基础
### 网络
### 操作系统
#### 进程
#### 文件系统
## AI 框架
### Transformer
### RAG
#### 向量库
#### 检索增强
## 工具链
```

### 长文本图

```yxmm
---
structure:
  layout: mindmap-up
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
font:
  lineHeight: 22
---

# 上向长文本
## 多行主题 [maxWidth=360]
第一行内容用于检查上向布局。
第二行内容用于检查水平占位。
### 新主题新主题新主题新主题新主题新主题新主题新主题新主题新主题新主题新主题新主题新主题新主题新主题
### 新主题
### 这是一个很长的普通主题，用来检查向上展开时横向空间是否节省
#### 新主题
#### 更深层级的长文本主题 新主题新主题新主题新主题新主题新主题新主题新主题
#### 新主题
## 另一个分支
### English mixed content with spaces should wrap by words
```

## mindmap-vertical

### 小图

```yxmm
---
structure:
  layout: mindmap-vertical
color:
  scheme: neon-rainbow
---

# 垂直小图
## 上下分配一
## 上下分配二
## 上下分配三
```

### 中图

```yxmm
---
structure:
  layout: mindmap-vertical
  connectorStyle: elbow
  branchExpansion: hanging
color:
  scheme: neon-rainbow
---

# 垂直中图
## 上侧知识
### 网络
### 操作系统
#### 进程
#### 文件系统
## 下侧实践
### Transformer
### RAG
#### 向量库
#### 检索增强
## 复盘
### 输出
```

### 长文本图

```yxmm
---
structure:
  layout: mindmap-vertical
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
color:
  scheme: neon-rainbow
font:
  lineHeight: 22
---

# 垂直长文本
## 上侧多行主题 [maxWidth=360]
第一行检查上侧长文本。
第二行检查真实换行。
### 这是一个很长的普通主题，用来检查垂直双向布局上侧折行
## 下侧多行主题 [maxWidth=360]
第一行检查下侧长文本。
第二行检查真实换行。
### 这是一个很长的普通主题，用来检查垂直双向布局下侧折行
## 新主题a
## 新主题b
### 新主题000
### 新主题00
### 新主题0
#### 新主题
#### 新主题1
#### 新主题
#### 新主题2
### 新主题
## 新主题c
```

```yxmm
---
structure:
  layout: mindmap-vertical
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
color:
  scheme: neon-rainbow
font:
  lineHeight: 22
---

# 垂直长文本
## 上侧多行主题 [maxWidth=360]
第一行检查上侧长文本。
第二行检查真实换行。
### 这是一个很长的普通主题，用来检查垂直双向布局上侧折行
## 下侧多行主题 [maxWidth=360]
第一行检查下侧长文本。
第二行检查真实换行。
### 这是一个很长的普通主题，用来检查垂直双向布局下侧折行
```

## tree-right

### 小图

```yxmm
---
structure:
  layout: tree-right
color:
  scheme: ocean
---

# 右向树形小图
## 一组
## 二组
```

### 中图

```yxmm
---
structure:
  layout: tree-right
  branchExpansion: hanging
color:
  scheme: ocean
---

# 右向树形中图
## 一组
### 一组-一
### 一组-二
#### 一组-二-一
#### 一组-二-二
### 一组-三
## 二组
### 二组-一
### 二组-二
#### 二组-二-一
#### 二组-二-二
## 三组
```

### 长文本图

```yxmm
---
structure:
  layout: tree-right
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: ocean
font:
  size: 16
  lineHeight: 22
---

# 右向树形长文本
## 多行树干主题 [maxWidth=360]
第一行检查树形图主干。
第二行检查主题高度不一致时是否重叠。
### 这是一个很长的普通主题，用来检查右向树形图下挂展开
#### 更深层级长文本主题
## 另一个大分支
### 较短主题
### English mixed content with spaces should wrap by words
```

## tree-left

### 小图

```yxmm
---
structure:
  layout: tree-left
color:
  scheme: forest
---

# 左向树形小图
## 一组
## 二组
```

### 中图

```yxmm
---
structure:
  layout: tree-left
  branchExpansion: hanging
color:
  scheme: forest
---

# 左向树形中图
## 一组
### 一组-一
### 一组-二
#### 一组-二-一
#### 一组-二-二
### 一组-三
## 二组
### 二组-一
### 二组-二
#### 二组-二-一
#### 二组-二-二
## 三组
```

### 长文本图

```yxmm
---
structure:
  layout: tree-left
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: forest
font:
  size: 16
  lineHeight: 22
---

# 左向树形长文本
## 多行树干主题 [maxWidth=360]
第一行检查树形图主干。
第二行检查主题高度不一致时是否重叠。
### 这是一个很长的普通主题，用来检查左向树形图下挂展开
#### 更深层级长文本主题
## 另一个大分支
### 较短主题
### English mixed content with spaces should wrap by words
```

## tree

### 小图

```yxmm
---
structure:
  layout: tree
color:
  scheme: pastel-rainbow
---

# 树形小图
## 一组
## 二组
## 三组
```

### 中图

```yxmm
---
structure:
  layout: tree
  branchExpansion: hanging
color:
  scheme: pastel-rainbow
---

# 树形中图
## 一组
### 一组-一
### 一组-二
#### 一组-二-一
#### 一组-二-二
### 一组-三
## 二组
### 二组-一
### 二组-二
#### 二组-二-一
#### 二组-二-二
## 三组
### 三组-一
```

### 长文本图

```yxmm
---
structure:
  layout: tree
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: pastel-rainbow
font:
  size: 16
  lineHeight: 22
---

# 树形长文本
## 多行树干主题 [maxWidth=360]
第一行检查双侧树形图。
第二行检查左右分支空间利用率。
### 这是一个很长的普通主题，用来检查树形图下挂展开
#### 更深层级长文本主题
## 另一个大分支
### 较短主题
### English mixed content with spaces should wrap by words
```

## org

### 小图

```yxmm
---
structure:
  layout: org
color:
  scheme: ocean
---

# 组织小图
## 研发
## 设计
## 运营
```

### 中图

```yxmm
---
structure:
  layout: org
  branchExpansion: hanging
color:
  scheme: ocean
---

# 组织中图
## 研发
### 前端
### 后端
#### API
#### 数据库
### 测试
## 设计
### 交互
### 视觉
## 运营
### 内容
```

### 长文本图

```yxmm
---
structure:
  layout: org
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: ocean
font:
  lineHeight: 22
---

# 组织长文本
## 多行部门主题 [maxWidth=360]
第一行检查组织结构图。
第二行检查上下层级对齐。
### 这是一个很长的岗位主题，用来检查组织结构图文本折行
#### 更深层级职责说明
##### 新主题
## 另一个部门
### 短主题
#### 新主题
```

## org-right

### 小图

```yxmm
---
structure:
  layout: org-right
color:
  scheme: forest
---

# 右向组织小图
## 研发
## 设计
```

### 中图

```yxmm
---
structure:
  layout: org-right
  branchExpansion: hanging
color:
  scheme: forest
---

# 右向组织中图
## 研发
### 前端
### 后端
#### API
#### 数据库
### 测试
## 设计
### 交互
### 视觉
## 运营
### 内容
```

### 长文本图

```yxmm
---
structure:
  layout: org-right
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: forest
font:
  size: 16
  lineHeight: 22
---

# 右向组织长文本
## 多行部门主题 [maxWidth=360]
第一行检查右向组织结构图。
第二行检查后代主题是否紧凑。
### 这是一个很长的岗位主题，用来检查右向组织结构图文本折行
#### 更深层级职责说明
## 另一个部门
### 短主题
```

## timeline-up

### 小图

```yxmm
---
structure:
  layout: timeline-up
color:
  scheme: sunset
---

# 上侧时间轴小图
## 立项
## 开发
## 发布
```

### 中图

```yxmm
---
structure:
  layout: timeline-up
  branchExpansion: hanging
color:
  scheme: sunset
---

# 上侧时间轴中图
## 立项
### 需求
### 评审
#### 风险
#### 范围
## 开发
### 前端
### 后端
#### API
#### 数据库
## 发布
### 验收
```

### 长文本图

```yxmm
---
structure:
  layout: timeline-up
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: sunset
font:
  size: 16
  lineHeight: 22
---

# 上侧时间轴长文本
## 多行时间点 [maxWidth=360]
第一行检查上侧时间轴。
第二行检查轴上节点高度与最近三级主题高度匹配。
### 这是一个很长的事件详情主题，用来检查时间轴上侧下挂方向
#### 更深层级事件说明
## 另一个时间点
### 短主题
```

## timeline-down

### 小图

```yxmm
---
structure:
  layout: timeline-down
---

# 下侧时间轴小图
## 立项
## 开发
## 发布
```

### 中图

```yxmm
---
structure:
  layout: timeline-down
  branchExpansion: hanging
---

# 下侧时间轴中图
## 立项
### 需求
### 评审
#### 风险
#### 范围
## 开发
### 前端
### 后端
#### API
#### 数据库
## 发布
### 验收
```

### 长文本图

```yxmm
---
structure:
  layout: timeline-down
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: grape
font:
  size: 16
  lineHeight: 22
---

# 下侧时间轴长文本
## 多行时间点 [maxWidth=360]
第一行检查下侧时间轴。
第二行检查轴上节点高度与最近三级主题高度匹配。
### 这是一个很长的事件详情主题，用来检查时间轴下侧下挂方向
#### 更深层级事件说明
## 另一个时间点
### 短主题
```

## timeline

### 小图

```yxmm
---
structure:
  layout: timeline
color:
  scheme: neon-rainbow
---

# 双侧时间轴小图
## 立项
## 开发
## 发布
```

### 中图

```yxmm
---
structure:
  layout: timeline
  branchExpansion: hanging
color:
  scheme: neon-rainbow
---

# 双侧时间轴中图
## 立项
### 需求
### 评审
#### 风险
#### 范围
## 开发
### 前端
### 后端
#### API
#### 数据库
## 发布
### 验收
## 复盘
### 总结
```

### 长文本图

```yxmm
---
structure:
  layout: timeline
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: neon-rainbow
font:
  size: 16
  lineHeight: 22
---

# 双侧时间轴长文本
## 上侧多行时间点 [maxWidth=360]
第一行检查上侧详情。
第二行检查高度不一致时的间距。
### 这是一个很长的事件详情主题，用来检查双侧时间轴上侧折行
## 下侧多行时间点 [maxWidth=360]
第一行检查下侧详情。
第二行检查高度不一致时的间距。
### 这是一个很长的事件详情主题，用来检查双侧时间轴下侧折行
```

## radial

### 小图

```yxmm
---
structure:
  layout: radial
color:
  scheme: pastel-rainbow
---

# 放射小图
## 基础
## 实践
## 复盘
```

### 中图

```yxmm
---
structure:
  layout: radial
color:
  scheme: pastel-rainbow
---

# 放射中图
## 基础
### 网络
### 操作系统
#### 进程
#### 文件系统
## 实践
### Transformer
### RAG
#### 向量库
#### 检索增强
## 复盘
### 输出
```

### 长文本图

```yxmm
---
structure:
  layout: radial
  topicMaxWidth:
    level2: 320
color:
  scheme: pastel-rainbow
font:
  lineHeight: 22
---

# 放射长文本
## 多行主题 [maxWidth=340]
第一行检查放射图。
第二行检查碰撞避让和空间利用率。
### 这是一个很长的普通主题，用来检查放射图文本折行
#### 更深层级长文本主题
## 另一个方向
### 短主题
```

## fishbone-right

### 小图

```yxmm
---
structure:
  layout: fishbone-right
color:
  scheme: forest
---

# 右向鱼骨小图
## 原因一
## 原因二
```

### 中图

```yxmm
---
structure:
  layout: fishbone-right
color:
  scheme: forest
---

# 右向鱼骨中图
## 原因一
### 子原因一
### 子原因二
#### 细节一
#### 细节二
## 原因二
### 子原因三
### 子原因四
#### 细节三
## 原因三
### 子原因五
```

### 长文本图

```yxmm
---
structure:
  layout: fishbone-right
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: forest
font:
  lineHeight: 22
---

# 右向鱼骨长文本
## 多行大分支 [maxWidth=360]
第一行检查鱼骨图斜骨线。
第二行检查大分支宽高不一致时是否重叠。
### 这是一个很长的鱼刺主题，用来检查鱼骨图文本折行
#### 更深层级鱼刺说明
## 另一个大分支
### 短主题
```

## fishbone-left

### 小图

```yxmm
---
structure:
  layout: fishbone-left
color:
  scheme: grape
---

# 左向鱼骨小图
## 原因一
## 原因二
```

### 中图

```yxmm
---
structure:
  layout: fishbone-left
color:
  scheme: grape
---

# 左向鱼骨中图
## 原因一
### 子原因一
### 子原因二
#### 细节一
#### 细节二
## 原因二
### 子原因三
### 子原因四
#### 细节三
## 原因三
### 子原因五
```

### 长文本图

```yxmm
---
structure:
  layout: fishbone-left
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: grape
font:
  size: 16
  lineHeight: 22
---

# 左向鱼骨长文本
## 多行大分支 [maxWidth=360]
第一行检查鱼骨图斜骨线。
第二行检查大分支宽高不一致时是否重叠。
### 这是一个很长的鱼刺主题，用来检查鱼骨图文本折行
#### 更深层级鱼刺说明
## 另一个大分支
### 短主题
```

## tree-table

### 小图

```yxmm
---
structure:
  layout: tree-table
color:
  scheme: ocean
---

# 表格小图
## 一组
## 二组
```

### 中图

```yxmm
---
structure:
  layout: tree-table
color:
  scheme: default
---

# 表格中图
## 一组
### 一组-一
### 一组-二
#### 一组-二-一
#### 一组-二-二
## 二组
### 二组-一
### 二组-二
#### 二组-二-一
## 三组
```

### 长文本图

```yxmm
---
structure:
  layout: tree-table
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: ocean
font:
  size: 16
  lineHeight: 22
---

# 表格长文本
## 多行表格主题 [maxWidth=360]
第一行检查树形表格。
第二行检查叶子主题填满剩余列。
### 这是一个很长的表格主题，用来检查表格内文本折行
#### 更深层级表格主题
## 另一个分支
### 短主题
```

## tree-table-stepped

### 小图

```yxmm
---
structure:
  layout: tree-table-stepped
color:
  scheme: forest
---

# 阶梯表格小图
## 一组
## 二组
```

### 中图

```yxmm
---
structure:
  layout: tree-table-stepped
color:
  scheme: forest
---

# 阶梯表格中图
## 一组
### 一组-一
### 一组-二
#### 一组-二-一
#### 一组-二-二
## 二组
### 二组-一
### 二组-二
#### 二组-二-一
## 三组
```

### 长文本图

```yxmm
---
structure:
  layout: tree-table-stepped
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: forest
font:
  size: 16
  lineHeight: 22
---

# 阶梯表格长文本
## 多行表格主题 [maxWidth=360]
第一行检查阶梯树形表格。
第二行检查叶子主题不填满剩余列。
### 这是一个很长的表格主题，用来检查阶梯表格内文本折行
#### 更深层级表格主题
## 另一个分支
### 短主题
```

## 多代码块专项

### 多代码块 A

```yxmm
---
structure:
  layout: mindmap-right
  connectorStyle: elbow
color:
  scheme: ocean
---

# 多代码块 A
## 复制图片
### 当前块应该是 A
## 源码同步
### 修改这里不应影响 B
```

### 多代码块 B

```yxmm
---
structure:
  layout: mindmap-left
  connectorStyle: elbow
color:
  scheme: forest
---

# 多代码块 B
## 复制图片
### 当前块应该是 B
## 源码同步
### 修改这里不应影响 A
```

## 主题编辑专项

```yxmm
---
structure:
  layout: mindmap-right
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
color:
  scheme: ocean
font:
  family: "var(--font-text)"
  size: 16
  weight: 400
  lineHeight: 20
---

# 主题编辑专项 [color=#3b82f6 icon=check fontSize=22 fontWeight=700 lineHeight=28 maxWidth=320]
## 颜色和图标 [color=#10b981 icon=book]
### 修改颜色后取消，应该恢复原值
### 修改图标后保存，源码属性应更新
## 字体和宽度 [fontSize=20 fontWeight=800 lineHeight=30 maxWidth=360]
第一行用于检查多行主题编辑。
第二行用于检查保存后源码结构。
### 子主题一
### 子主题二
## 删除和新增
### 删除带子主题的主题应提示确认
#### 被删除确认覆盖的后代主题
### 新增子主题后级别应正确
```

## 富内容专项

```yxmm
---
structure:
  layout: mindmap-right
  connectorStyle: elbow
  branchExpansion: hanging
color:
  scheme: ocean
font:
  lineHeight: 22
---

# 富内容专项
## 标签、链接与混合样式
### 行内语法 [外部链接](https://example.com) 和 #标签
### 内部链接 [[本地笔记|显示别名]] 和 **加粗** *斜体*
### ~~中划线~~ ++下划线++ {red|语义色} {#3b82f6|十六进制色}
## 任务项
### 未完成任务
- [ ] 任务描述一
- [ ] 任务描述二
#列表
### 已完成任务
- [x] 已勾选事项一
- [x] 已勾选事项二
#列表
## 嵌套列表
### 无序列表
- 一级列表项一
  - 二级列表项一
  - 二级列表项二
- 一级列表项二
#列表
### 有序列表
1. 第一步
   2. 嵌套有序
   2. 嵌套有序
2. 第二步
#列表
## 图片
### Markdown 图片
![示例图片](https://picsum.photos/id/287/300/200)
### 带尺寸图片
![固定宽高](xhttps://picsum.photos/id/287/800/800|400x200)
### Obsidian 附件图片
![[attachments/sample.png]]
## 备注与附件
### 备注浮层
> 这是备注浮层内容
> 连续多行合并为一个浮层
### Markdown 附件
@[附件名称](https://example.com/file.pdf)
### Obsidian 附件
@[[attachments/document|文档]]
## 方程式
$$
E = mc^2
$$
## 代码块
~~~javascript
console.log("hello")
~~~
```

## 水印专项

先在配置面板的“水印”选项卡完成自行确认解锁，再分别检查以下两个代码块。

### 底部签名水印条

```yxmm
---
display:
  viewFit: fit
watermark:
  enabled: true
  mode: signature
  signature:
    style: bar
    text: "Made with Yonxao Mind Map"
    position: bottom-right
---

# 水印条回归
## 视口定位
### 缩放和平移后仍贴合底部
## 图层顺序
### 不遮挡主题和编辑控件
```

预期：水印条占满视口宽度、保留浅色底且不显示分隔线；主题内容不进入水印条区域，编辑控件仍位于签名上方；深浅主题切换后内置文字颜色立即变化。

### 普通平铺文字水印

```yxmm
---
display:
  viewFit: fit
watermark:
  enabled: true
  mode: normal
  normal:
    type: text
    arrangement: tiled
    position: center
    text: "© Yonxao"
    color: "#64748b"
    opacity: 0.18
    rotation: -30
    width: 160
    height: 80
    gapX: 120
    gapY: 100
---

# 平铺水印回归
## 内容层级
### 水印位于主题和连线下方
## 导出一致性
### 复制图片与导出图片保持一致
```

预期：平铺水印限制在导图内容边界内、位于主题和连线下方且不拦截交互；复制图片和导出图片中的位置、透明度和旋转与画布一致。

## 配置面板专项

```yxmm
---
display:
  viewFit: fit
structure:
  layout: mindmap-bidirectional
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level1: 320
    level2: 300
    level3: 260
color:
  scheme: ocean
  defaultTopicColor: "#156bf4"
font:
  family: "var(--font-text)"
  size: 16
  weight: 400
  lineHeight: 20
  level1:
    size: 24
    weight: 800
    lineHeight: 32
interaction:
  wheelZoom: false
  tabIndent: true
---

# 配置面板专项
## 全局默认值回填
### 打开配置面板检查默认值置灰
## 代码块配置覆盖
### 修改后保存，配置区应保持简洁
## 主题属性优先
### 单主题颜色优先 [color=#ef4444]
```

## 移动端降级专项

```yxmm
---
display:
  viewFit: fit
structure:
  layout: mindmap-right
  connectorStyle: elbow
  branchExpansion: hanging
color:
  scheme: ocean
---

# 移动端降级
## 基础显示
### 阅读视图不应崩溃
### 工具栏不应遮挡到无法操作
## 能力降级
### 复制图片不可用时应提示
### 全屏不可用时应提示
```
