/*
 * 文件作用：
 * 这里定义 Obsidian 插件类，负责把 yonxao-mindmap 接入 Obsidian 的 Markdown 渲染流程。
 *
 * 执行逻辑：
 * 1. Obsidian 加载插件后调用 onload()。
 * 2. onload() 注册 ```yxmm 代码块处理器。
 * 3. 当阅读视图或 Live Preview 遇到 yxmm 代码块时，创建 YonxaoMindmapRenderer。
 * 4. Renderer 负责后续的解析、绘制、编辑和保存。
 *
 * 调用链位置：
 * main.js -> YonxaoMindmapPlugin.onload() -> registerMarkdownCodeBlockProcessor() -> YonxaoMindmapRenderer
 */

import { Plugin } from 'obsidian';

import { CODE_BLOCK_NAME } from '../constants.js';
import { renderPluginError } from '../obsidian/embed.js';
import { YonxaoMindmapRenderer } from '../renderer/YonxaoMindmapRenderer.js';

export class YonxaoMindmapPlugin extends Plugin {
  /*
   * 作用：
   * Obsidian 插件生命周期入口，负责注册 yxmm 代码块处理器。
   *
   * 调用链：
   * Obsidian 启用插件 -> onload() -> registerMarkdownCodeBlockProcessor() -> YonxaoMindmapRenderer。
   */
  async onload() {
    // Obsidian 在阅读模式渲染 Markdown 时会回调这个处理器。
    // 这里注册的是 ```yxmm 代码块，source 是代码块内部的原始文本。
    this.registerMarkdownCodeBlockProcessor(CODE_BLOCK_NAME, (source, el, ctx) => {
      try {
        const renderer = new YonxaoMindmapRenderer(this, source, el, ctx);
        ctx.addChild(renderer);
        renderer.mount();
      } catch (error) {
        renderPluginError(el, error);
      }
    });

    /*
     * 这里有一个重要取舍：
     * Obsidian 的 registerMarkdownCodeBlockProcessor 不只服务阅读视图，也会参与 Live Preview
     * 中“已渲染代码块”的显示。也就是说，编辑视图和阅读视图可以共用同一个
     * YonxaoMindmapRenderer。
     *
     * 之前额外注册过 CodeMirror Decoration.replace 扩展，试图直接替换编辑器里的 fenced code block。
     * 这种做法依赖 CodeMirror/Obsidian 内部 DOM 和装饰规则，版本稍有差异就可能在打开文件阶段抛错，
     * 最糟糕的表现就是整篇 Markdown 显示“打开失败”，并且还没机会渲染插件自己的错误提示。
     *
     * 因此当前版本不再注册自定义 CodeMirror 扩展，而是走 Obsidian 官方 Markdown 代码块渲染管线。
     * 源码/脑图切换、节点编辑、幕布高度调整仍然由同一个 renderer 完成。
     * Obsidian 自带的“编辑这个块”按钮继续保留，插件工具栏放在左上角来避开它。
     */
  }
}
