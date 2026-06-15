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

import { getLanguage, Plugin } from 'obsidian';

import { CODE_BLOCK_NAME } from '../constants.js';
import { normalizePluginSettings } from '../config/pluginSettings.js';
import { createTranslator, languageFromObsidianLocale } from '../i18n/messages.js';
import { renderPluginError } from '../obsidian/embed.js';
import { YonxaoMindmapRenderer } from '../renderer/YonxaoMindmapRenderer.js';
import { YonxaoMindmapSettingTab } from '../ui/YonxaoMindmapSettingTab.js';

export class YonxaoMindmapPlugin extends Plugin {
  constructor(app, manifest) {
    super(app, manifest);

    /*
     * 当前已挂载的 yxmm 渲染器集合。
     *
     * 为什么需要记录：
     * 当用户在 Obsidian 偏好设置里修改“全局默认配置”后，已经显示在当前页面里的导图
     * 也应该能收到通知并重新读取默认值。这里不保存文档数据，只保存运行中的 renderer 引用。
     */
    this.activeRenderers = new Set();
    this.settings = normalizePluginSettings({}, this.getObsidianLanguage());
    this.translate = createTranslator(this.settings.language);
  }

  /*
   * 作用：
   * Obsidian 插件生命周期入口，负责读取插件设置、注册设置页和 yxmm 代码块处理器。
   *
   * 调用链：
   * Obsidian 启用插件 -> onload() -> registerMarkdownCodeBlockProcessor() -> YonxaoMindmapRenderer。
   */
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new YonxaoMindmapSettingTab(this.app, this));

    // Obsidian 在阅读模式渲染 Markdown 时会回调这个处理器。
    // 这里注册的是 ```yxmm 代码块，source 是代码块内部的原始文本。
    this.registerMarkdownCodeBlockProcessor(CODE_BLOCK_NAME, (source, el, ctx) => {
      try {
        const renderer = new YonxaoMindmapRenderer(this, source, el, ctx);
        this.trackRenderer(renderer);
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
     * 源码/导图切换、主题编辑、幕布高度调整仍然由同一个 renderer 完成。
     * Obsidian 自带的“编辑这个块”按钮继续保留，插件工具栏按配置吸附在幕布四角内侧或外侧。
     */
  }

  /*
   * 作用：
   * 从 Obsidian data.json 读取插件偏好设置。
   */
  async loadSettings() {
    this.settings = normalizePluginSettings(await this.loadData(), this.getObsidianLanguage());
    this.refreshTranslator();
  }

  /*
   * 作用：
   * 将当前插件偏好设置写回 Obsidian data.json。
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }

  /*
   * 作用：
   * 读取当前界面语言。
   */
  getLanguage() {
    return normalizePluginSettings(this.settings, this.getObsidianLanguage()).language;
  }

  /*
   * 作用：
   * 读取 Obsidian 当前界面语言，并映射成插件支持的语言代码。
   *
   * 关键点：
   * 这个值只作为首次默认语言；用户在插件偏好设置中手动选择后，会保存到 data.json，
   * 后续就以保存值为准。
   */
  getObsidianLanguage() {
    const obsidianLocale = typeof getLanguage === 'function' ? getLanguage() : '';
    return languageFromObsidianLocale(obsidianLocale);
  }

  /*
   * 作用：
   * 更新界面语言并刷新当前已打开导图。
   */
  async updateLanguage(language) {
    this.settings = normalizePluginSettings(
      {
        ...this.settings,
        language,
      },
      this.getObsidianLanguage()
    );
    this.refreshTranslator();
    await this.saveSettings();
    this.refreshActiveRenderers();
  }

  /*
   * 作用：
   * 重新创建翻译函数。
   *
   * 关键点：
   * translate 是一个闭包，内部固定当前语言；语言切换后需要重新创建。
   */
  refreshTranslator() {
    this.translate = createTranslator(this.getLanguage());
  }

  /*
   * 作用：
   * 插件内统一翻译入口。
   */
  t(key, replacements) {
    return this.translate(key, replacements);
  }

  /*
   * 作用：
   * 读取全局默认配置。
   *
   * 关键点：
   * 返回的是 raw config，也就是和 yxmm 配置区一致的结构；renderer 会在使用前再统一规范化。
   */
  getGlobalDefaultConfig() {
    return normalizePluginSettings(this.settings, this.getObsidianLanguage()).defaultConfig;
  }

  /*
   * 作用：
   * 更新全局默认配置，并通知当前页面里的渲染器重新读取默认值。
   */
  async updateGlobalDefaultConfig(defaultConfig) {
    this.settings = normalizePluginSettings(
      {
        ...this.settings,
        defaultConfig,
      },
      this.getObsidianLanguage()
    );
    await this.saveSettings();
    this.refreshActiveRenderers();
  }

  /*
   * 作用：
   * 跟踪当前挂载的 renderer，renderer 卸载时自动从集合移除。
   */
  trackRenderer(renderer) {
    this.activeRenderers.add(renderer);
    renderer.register(() => {
      this.activeRenderers.delete(renderer);
    });
  }

  /*
   * 作用：
   * 全局默认配置变化后刷新已打开的导图。
   */
  refreshActiveRenderers() {
    for (const renderer of this.activeRenderers) {
      renderer.applyGlobalDefaultConfig?.();
    }
  }
}
