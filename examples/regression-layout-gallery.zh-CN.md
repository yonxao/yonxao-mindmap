# yonxao-mindmap 布局回归样例集合

这个文件用于人工回归测试。建议把本文件放进 Obsidian 测试库中，分别在 Live Preview、
阅读视图、浅色主题、深色主题下检查。

每个布局都包含三类样例：

- 小图：检查基础渲染、按钮和主干方向。
- 中图：检查多层主题、折叠按钮、空间利用率。
- 长文本图：检查多行文本、最大宽度、字体和边距。

## 连线线型与下挂展开专项

### 曲线连线

```yxmm
---
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: mindmap-right
  connectorStyle: curve
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: forest
layout:
  type: mindmap-right
  connectorStyle: straight
  branchExpansion: hanging
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

### 折线连线与下挂展开

```yxmm
---
theme:
  scheme: neon-rainbow
layout:
  connectorStyle: elbow
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: mindmap-right
---

# 右向小图
## 基础
## 操作系统
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 420
theme:
  scheme: ocean
layout:
  type: mindmap-right
  connectorStyle: elbow
  branchExpansion: hanging
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
theme:
  scheme: ocean
layout:
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 320
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
theme:
  scheme: forest
layout:
  type: mindmap-left
---

# 左向小图
## 基础
## 操作系统
```

### 中图

```yxmm
---
basic:
  viewFit: original
theme:
  scheme: forest
layout:
  type: mindmap-left
  connectorStyle: elbow
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: forest
layout:
  type: mindmap-left
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 320
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
basic:
  viewFit: fit
theme:
  scheme: pastel-rainbow
layout:
  type: mindmap-bidirectional
---

# 双向小图
## 左右分配一
## 左右分配二
## 左右分配三
```

### 中图

```yxmm
---
basic:
  canvasHeight: 430
  viewFit: original
theme:
  scheme: pastel-rainbow
layout:
  type: mindmap-bidirectional
  connectorStyle: elbow
  branchExpansion: hanging
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
theme:
  scheme: pastel-rainbow
layout:
  type: mindmap-bidirectional
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
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
basic:
  viewFit: fit
theme:
  scheme: sunset
layout:
  type: mindmap-down
---

# 下向小图
## 基础
## 操作系统
```

### 中图

```yxmm
---
basic:
  canvasHeight: 460
  viewFit: original
theme:
  scheme: sunset
layout:
  type: mindmap-down
  connectorStyle: elbow
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: sunset
layout:
  type: mindmap-down
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
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
basic:
  viewFit: fit
theme:
  scheme: grape
layout:
  type: mindmap-up
---

# 上向小图
## 基础
## 操作系统
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 460
theme:
  scheme: grape
layout:
  type: mindmap-up
  connectorStyle: elbow
  branchExpansion: hanging
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
basic:
  canvasHeight: 411
layout:
  type: mindmap-up
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
basic:
  viewFit: fit
theme:
  scheme: neon-rainbow
layout:
  type: mindmap-vertical
---

# 垂直小图
## 上下分配一
## 上下分配二
## 上下分配三
```

### 中图

```yxmm
---
basic:
  viewFit: original
theme:
  scheme: neon-rainbow
layout:
  type: mindmap-vertical
  connectorStyle: elbow
  branchExpansion: hanging
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
theme:
  scheme: neon-rainbow
layout:
  type: mindmap-vertical
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
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
## 新主题
## 新主题
### 新主题
### 新主题
```

## tree-right

### 小图

```yxmm
---
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: tree-right
---

# 右向树形小图
## 一组
## 二组
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 520
theme:
  scheme: ocean
layout:
  type: tree-right
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: tree-right
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
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
basic:
  viewFit: fit
theme:
  scheme: forest
layout:
  type: tree-left
---

# 左向树形小图
## 一组
## 二组
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 520
theme:
  scheme: forest
layout:
  type: tree-left
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: forest
layout:
  type: tree-left
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
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
basic:
  viewFit: fit
theme:
  scheme: pastel-rainbow
layout:
  type: tree
---

# 树形小图
## 一组
## 二组
## 三组
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 560
theme:
  scheme: pastel-rainbow
layout:
  type: tree
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: pastel-rainbow
layout:
  type: tree
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
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
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: org
---

# 组织小图
## 研发
## 设计
## 运营
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 520
theme:
  scheme: ocean
layout:
  type: org
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: org
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
font:
  size: 16
  lineHeight: 22
---

# 组织长文本
## 多行部门主题 [maxWidth=360]
第一行检查组织结构图。
第二行检查上下层级对齐。
### 这是一个很长的岗位主题，用来检查组织结构图文本折行
#### 更深层级职责说明
## 另一个部门
### 短主题
```

## org-right

### 小图

```yxmm
---
basic:
  viewFit: fit
theme:
  scheme: forest
layout:
  type: org-right
---

# 右向组织小图
## 研发
## 设计
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 520
theme:
  scheme: forest
layout:
  type: org-right
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: forest
layout:
  type: org-right
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
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
basic:
  viewFit: fit
theme:
  scheme: sunset
layout:
  type: timeline-up
---

# 上侧时间轴小图
## 立项
## 开发
## 发布
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 520
theme:
  scheme: sunset
layout:
  type: timeline-up
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: sunset
layout:
  type: timeline-up
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
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
basic:
  viewFit: fit
theme:
  scheme: grape
layout:
  type: timeline-down
---

# 下侧时间轴小图
## 立项
## 开发
## 发布
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 520
theme:
  scheme: grape
layout:
  type: timeline-down
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
basic:
  viewFit: fit
theme:
  scheme: grape
layout:
  type: timeline-down
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
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
basic:
  viewFit: fit
theme:
  scheme: neon-rainbow
layout:
  type: timeline
---

# 双侧时间轴小图
## 立项
## 开发
## 发布
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 560
theme:
  scheme: neon-rainbow
layout:
  type: timeline
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: neon-rainbow
layout:
  type: timeline
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
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
basic:
  viewFit: fit
theme:
  scheme: pastel-rainbow
layout:
  type: radial
---

# 放射小图
## 基础
## 实践
## 复盘
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 560
theme:
  scheme: pastel-rainbow
layout:
  type: radial
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
basic:
  viewFit: fit
theme:
  scheme: pastel-rainbow
layout:
  type: radial
  branchExpansion: hanging
  topicMaxWidth:
    global: 240
    level2: 320
font:
  size: 16
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

## fishbone-left

### 小图

```yxmm
---
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: fishbone-left
---

# 左向鱼骨小图
## 原因一
## 原因二
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 560
theme:
  scheme: ocean
layout:
  type: fishbone-left
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: fishbone-left
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
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

## fishbone-right

### 小图

```yxmm
---
basic:
  viewFit: fit
theme:
  scheme: forest
layout:
  type: fishbone-right
---

# 右向鱼骨小图
## 原因一
## 原因二
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 560
theme:
  scheme: forest
layout:
  type: fishbone-right
  branchExpansion: hanging
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
basic:
  viewFit: fit
theme:
  scheme: forest
layout:
  type: fishbone-right
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
font:
  size: 16
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

## tree-table

### 小图

```yxmm
---
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: tree-table
---

# 表格小图
## 一组
## 二组
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 500
theme:
  scheme: ocean
layout:
  type: tree-table
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
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: tree-table
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
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
basic:
  viewFit: fit
theme:
  scheme: forest
layout:
  type: tree-table-stepped
---

# 阶梯表格小图
## 一组
## 二组
```

### 中图

```yxmm
---
basic:
  viewFit: original
  canvasHeight: 500
theme:
  scheme: forest
layout:
  type: tree-table-stepped
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
basic:
  viewFit: fit
theme:
  scheme: forest
layout:
  type: tree-table-stepped
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
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
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: mindmap-right
  connectorStyle: elbow
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
basic:
  viewFit: fit
theme:
  scheme: forest
layout:
  type: mindmap-left
  connectorStyle: elbow
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
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: mindmap-right
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level2: 340
font:
  family: var(--font-text)
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

## 配置面板专项

```yxmm
---
basic:
  viewFit: fit
  tabIndent: true
  wheelZoom: false
theme:
  scheme: ocean
  defaultTopicColor: "#156bf4"
layout:
  type: mindmap-bidirectional
  connectorStyle: elbow
  branchExpansion: hanging
  topicMaxWidth:
    global: 260
    level1: 320
    level2: 300
    level3: 260
font:
  family: var(--font-text)
  size: 16
  weight: 400
  lineHeight: 20
  level1:
    size: 24
    weight: 800
    lineHeight: 32
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
basic:
  viewFit: fit
theme:
  scheme: ocean
layout:
  type: mindmap-right
  connectorStyle: elbow
  branchExpansion: hanging
---

# 移动端降级
## 基础显示
### 阅读视图不应崩溃
### 工具栏不应遮挡到无法操作
## 能力降级
### 复制图片不可用时应提示
### 全屏不可用时应提示
```
