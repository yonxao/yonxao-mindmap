# @yonxao/mindmap-svg-renderer

Yonxao Mindmap 的宿主无关 SVG 与视口几何包。

该包依赖 `@yonxao/mindmap-core` 提供的主题模型和布局结果，并负责：

- 父子连接线锚点、裁剪和 SVG path。
- 主题边界点与编辑控件语义点。
- 外框、概要和关联结构的路径、边界与避障几何。
- 画布坐标、适配视图、原始大小和缩放 viewBox。
- 普通水印、平铺水印、角落签名和签名条几何。

该包不创建 DOM/SVG 元素，不读取文件或资源，也不绑定事件。Obsidian、Web、Electron 和移动端宿主根据返回的坐标、尺寸和 path 创建实际图形。

```ts
import { connectorAnchors, connectorPath, fitViewBox } from '@yonxao/mindmap-svg-renderer';

const anchors = connectorAnchors(parentBox, childBox);
const path = connectorPath(anchors, 'curve');
const viewBox = fitViewBox(contentBounds, viewportWidth, maxScale);
```

## 构建

```bash
npm run build --workspace @yonxao/mindmap-svg-renderer
npm run typecheck --workspace @yonxao/mindmap-svg-renderer
```
