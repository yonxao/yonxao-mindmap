/*
 * 文件作用：
 * 配置面板水印页，负责签名水印、普通文字水印和图片水印配置。
 */

import { FuzzySuggestModal, Notice } from 'obsidian';

import {
  WATERMARK_ARRANGEMENTS,
  WATERMARK_FONT_SIZE_MAX,
  WATERMARK_FONT_SIZE_MIN,
  WATERMARK_GAP_MAX,
  WATERMARK_GAP_MIN,
  WATERMARK_MODES,
  WATERMARK_OFFSET_MAX,
  WATERMARK_OFFSET_MIN,
  WATERMARK_OPACITY_MAX,
  WATERMARK_OPACITY_MIN,
  WATERMARK_ROTATION_MAX,
  WATERMARK_ROTATION_MIN,
  WATERMARK_SIGNATURE_STYLES,
  WATERMARK_SIZE_MAX,
  WATERMARK_SIZE_MIN,
  WATERMARK_TYPES,
  setConfigValue,
} from './configModalShared.js';

const WATERMARK_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif']);
const WATERMARK_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif';
const WATERMARK_PERCENT_SCALE = 100;

class WatermarkImageSuggestModal extends FuzzySuggestModal {
  constructor(app, onChoose, placeholder) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder(placeholder);
  }

  getItems() {
    return this.app.vault
      .getFiles()
      .filter((file) => WATERMARK_IMAGE_EXTENSIONS.has(String(file.extension || '').toLowerCase()));
  }

  getItemText(file) {
    return file.path;
  }

  onChooseItem(file) {
    this.onChoose(file.path);
  }
}

export const watermarkTabMethods = {
  renderWatermarkTab(normalized) {
    if (!this.watermarkUnlocked) {
      this.renderLockedWatermarkTab();
      return;
    }

    const watermark = normalized.watermark;
    const enabledToggle = this.createToggleField(
      this.t('configModal.watermark.enabled'),
      ['watermark', 'enabled'],
      watermark.enabled,
      { help: this.t('configModal.watermark.enabled.help') }
    );
    enabledToggle.addEventListener('change', () => this.render());
    // 关闭时只保留总开关；开启后再展示模式和参数，降低默认页面负担。
    if (!watermark.enabled) return;

    const mode = this.createWatermarkChoiceField(
      this.t('configModal.watermark.mode'),
      ['watermark', 'mode'],
      watermark.mode,
      WATERMARK_MODES.map((value) => [value, this.t(`configModal.watermark.mode.${value}`)]),
      { rerender: true }
    );

    this.createSection(
      mode === 'signature'
        ? this.t('configModal.watermark.signature.section')
        : this.t('configModal.watermark.normal.section')
    );
    if (mode === 'signature') {
      this.renderSignatureWatermarkFields(watermark.signature);
    } else {
      this.renderNormalWatermarkFields(watermark.normal);
    }
  },

  renderSignatureWatermarkFields(signature) {
    const style = this.createWatermarkChoiceField(
      this.t('configModal.watermark.signature.style'),
      ['watermark', 'signature', 'style'],
      signature.style,
      WATERMARK_SIGNATURE_STYLES.map((value) => [
        value,
        this.t(`configModal.watermark.signature.style.${value}`),
      ]),
      { rerender: true }
    );
    this.createTextField(
      this.t('configModal.watermark.content'),
      ['watermark', 'signature', 'text'],
      signature.text
    );
    const position = this.signatureWatermarkPositionForStyle(signature.position, style);
    if (position !== signature.position) {
      setConfigValue(this.draftConfig, ['watermark', 'signature', 'position'], position);
    }
    this.createSelectField(
      this.t('configModal.watermark.position'),
      ['watermark', 'signature', 'position'],
      position,
      style === 'bar' ? this.watermarkBarPositions() : this.watermarkPositionOptions()
    );
    this.createColorTextField(
      this.t('configModal.watermark.color'),
      ['watermark', 'signature', 'color'],
      signature.color
    );
    this.createColorTextField(
      this.t('configModal.watermark.backgroundColor'),
      ['watermark', 'signature', 'backgroundColor'],
      signature.backgroundColor,
      {
        allowTransparent: true,
        transparentLabel: this.t('configModal.watermark.transparent'),
      }
    );
    this.createWatermarkNumberPair(this.t('configModal.watermark.appearance'), [
      {
        label: this.t('configModal.watermark.fontSize'),
        path: ['watermark', 'signature', 'fontSize'],
        value: signature.fontSize,
        min: WATERMARK_FONT_SIZE_MIN,
        max: WATERMARK_FONT_SIZE_MAX,
        step: 1,
        suffix: 'px',
      },
      {
        label: this.t('configModal.watermark.opacity'),
        path: ['watermark', 'signature', 'opacity'],
        value: signature.opacity,
        min: WATERMARK_OPACITY_MIN,
        max: WATERMARK_OPACITY_MAX,
        step: 0.01,
        displayScale: WATERMARK_PERCENT_SCALE,
        suffix: '%',
      },
    ]);
    if (style === 'bar') {
      this.createWatermarkNumberPair(this.t('configModal.watermark.spacing'), [
        {
          label: this.t('configModal.watermark.barHeight'),
          path: ['watermark', 'signature', 'barHeight'],
          value: signature.barHeight,
          min: WATERMARK_SIZE_MIN,
          max: WATERMARK_SIZE_MAX,
          step: 1,
          suffix: 'px',
        },
        {
          label: this.watermarkPaddingAxisLabel('x'),
          path: ['watermark', 'signature', 'paddingX'],
          value: signature.paddingX,
          min: WATERMARK_GAP_MIN,
          max: WATERMARK_GAP_MAX,
          step: 1,
          suffix: 'px',
        },
      ]);
    } else {
      this.createWatermarkNumberPair(this.t('configModal.watermark.padding'), [
        {
          label: this.watermarkPaddingAxisLabel('x'),
          path: ['watermark', 'signature', 'paddingX'],
          value: signature.paddingX,
          min: WATERMARK_GAP_MIN,
          max: WATERMARK_GAP_MAX,
          step: 1,
          suffix: 'px',
        },
        {
          label: this.watermarkPaddingAxisLabel('y'),
          path: ['watermark', 'signature', 'paddingY'],
          value: signature.paddingY,
          min: WATERMARK_GAP_MIN,
          max: WATERMARK_GAP_MAX,
          step: 1,
          suffix: 'px',
        },
      ]);
    }
  },

  renderNormalWatermarkFields(normal) {
    const type = this.createWatermarkChoiceField(
      this.t('configModal.watermark.type'),
      ['watermark', 'normal', 'type'],
      normal.type,
      WATERMARK_TYPES.map((value) => [value, this.t(`configModal.watermark.type.${value}`)]),
      { rerender: true }
    );
    const arrangement = this.createWatermarkChoiceField(
      this.t('configModal.watermark.arrangement'),
      ['watermark', 'normal', 'arrangement'],
      normal.arrangement,
      WATERMARK_ARRANGEMENTS.map((value) => [
        value,
        this.t(`configModal.watermark.arrangement.${value}`),
      ]),
      { rerender: true }
    );
    if (arrangement === 'single') {
      this.createSelectField(
        this.t('configModal.watermark.position'),
        ['watermark', 'normal', 'position'],
        normal.position,
        this.watermarkPositionOptions()
      );
    }

    if (type === 'text') {
      this.createTextField(
        this.t('configModal.watermark.content'),
        ['watermark', 'normal', 'text'],
        normal.text
      );
      this.createColorTextField(
        this.t('configModal.watermark.color'),
        ['watermark', 'normal', 'color'],
        normal.color
      );
      this.createWatermarkNumberStepper(
        this.t('configModal.watermark.fontSize'),
        ['watermark', 'normal', 'fontSize'],
        normal.fontSize,
        {
          min: WATERMARK_FONT_SIZE_MIN,
          max: WATERMARK_FONT_SIZE_MAX,
          step: 1,
          suffix: 'px',
        }
      );
    } else {
      this.renderWatermarkImageSourceFields(normal);
    }

    this.createWatermarkNumberPair(this.t('configModal.watermark.appearance'), [
      {
        label: this.t('configModal.watermark.opacity'),
        path: ['watermark', 'normal', 'opacity'],
        value: normal.opacity,
        min: WATERMARK_OPACITY_MIN,
        max: WATERMARK_OPACITY_MAX,
        step: 0.01,
        displayScale: WATERMARK_PERCENT_SCALE,
        suffix: '%',
      },
      {
        label: this.t('configModal.watermark.rotation'),
        path: ['watermark', 'normal', 'rotation'],
        value: normal.rotation,
        min: WATERMARK_ROTATION_MIN,
        max: WATERMARK_ROTATION_MAX,
        step: 1,
        suffix: '°',
      },
    ]);
    if (type === 'image' || arrangement === 'tiled') {
      this.createWatermarkNumberPair(this.normalWatermarkSizeLabel(type, arrangement), [
        {
          label: this.t('configModal.watermark.width'),
          path: ['watermark', 'normal', 'width'],
          value: normal.width,
          min: WATERMARK_SIZE_MIN,
          max: WATERMARK_SIZE_MAX,
          step: 1,
          suffix: 'px',
        },
        {
          label: this.t('configModal.watermark.height'),
          path: ['watermark', 'normal', 'height'],
          value: normal.height,
          min: WATERMARK_SIZE_MIN,
          max: WATERMARK_SIZE_MAX,
          step: 1,
          suffix: 'px',
        },
      ]);
    }
    this.createWatermarkNumberPair(this.t('configModal.watermark.offset'), [
      {
        label: this.t('configModal.watermark.offsetX'),
        path: ['watermark', 'normal', 'offsetX'],
        value: normal.offsetX,
        min: WATERMARK_OFFSET_MIN,
        max: WATERMARK_OFFSET_MAX,
        step: 1,
        suffix: 'px',
      },
      {
        label: this.t('configModal.watermark.offsetY'),
        path: ['watermark', 'normal', 'offsetY'],
        value: normal.offsetY,
        min: WATERMARK_OFFSET_MIN,
        max: WATERMARK_OFFSET_MAX,
        step: 1,
        suffix: 'px',
      },
    ]);
    if (arrangement === 'tiled') {
      this.createWatermarkNumberPair(this.t('configModal.watermark.gap'), [
        {
          label: this.t('configModal.watermark.gapX'),
          path: ['watermark', 'normal', 'gapX'],
          value: normal.gapX,
          min: WATERMARK_GAP_MIN,
          max: WATERMARK_GAP_MAX,
          step: 1,
          suffix: 'px',
        },
        {
          label: this.t('configModal.watermark.gapY'),
          path: ['watermark', 'normal', 'gapY'],
          value: normal.gapY,
          min: WATERMARK_GAP_MIN,
          max: WATERMARK_GAP_MAX,
          step: 1,
          suffix: 'px',
        },
      ]);
    }
  },

  renderWatermarkImageSourceFields(normal) {
    this.createTextField(
      this.t('configModal.watermark.imageSource'),
      ['watermark', 'normal', 'imageSource'],
      normal.imageSource,
      { placeholder: this.t('configModal.watermark.imageSource.placeholder') }
    );
    const actionsEl = this.formEl.createDiv({ cls: 'yonxao-mindmap-watermark-image-actions' });
    const chooseButton = actionsEl.createEl('button', {
      text: this.t('configModal.watermark.image.chooseVault'),
      type: 'button',
    });
    chooseButton.addEventListener('click', () => {
      new WatermarkImageSuggestModal(
        this.app,
        (path) => this.setWatermarkImageSource(path),
        this.t('configModal.watermark.image.searchPlaceholder')
      ).open();
    });
    const uploadButton = actionsEl.createEl('button', {
      text: this.t('configModal.watermark.image.upload'),
      cls: 'mod-cta',
      type: 'button',
    });
    const uploadInput = actionsEl.createEl('input');
    uploadInput.type = 'file';
    uploadInput.accept = WATERMARK_IMAGE_ACCEPT;
    uploadButton.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', async () => {
      const file = uploadInput.files?.[0];
      if (file) await this.uploadWatermarkImage(file);
      // 允许用户在上传失败或替换文件后再次选择同名文件。
      uploadInput.value = '';
    });
  },

  setWatermarkImageSource(path) {
    setConfigValue(this.draftConfig, ['watermark', 'normal', 'imageSourceType'], 'vault');
    setConfigValue(this.draftConfig, ['watermark', 'normal', 'imageSource'], path);
    this.render();
  },

  async uploadWatermarkImage(file) {
    try {
      const destination = await this.app.fileManager.getAvailablePathForAttachment(
        file.name,
        this.sourcePath || ''
      );
      await this.app.vault.createBinary(destination, await file.arrayBuffer());
      this.setWatermarkImageSource(destination);
      new Notice(this.t('configModal.watermark.image.uploaded'));
    } catch (error) {
      const message = error?.message || String(error || '');
      new Notice(`${this.t('configModal.watermark.image.uploadFailed')} ${message}`.trim());
    }
  },

  watermarkPositionOptions() {
    return [
      ['top-left', this.t('configModal.watermark.position.topLeft')],
      ['top-center', this.t('configModal.watermark.position.topCenter')],
      ['top-right', this.t('configModal.watermark.position.topRight')],
      ['center-left', this.t('configModal.watermark.position.centerLeft')],
      ['center', this.t('configModal.watermark.position.center')],
      ['center-right', this.t('configModal.watermark.position.centerRight')],
      ['bottom-left', this.t('configModal.watermark.position.bottomLeft')],
      ['bottom-center', this.t('configModal.watermark.position.bottomCenter')],
      ['bottom-right', this.t('configModal.watermark.position.bottomRight')],
    ];
  },

  watermarkBarPositions() {
    return [
      ['top-right', this.t('configModal.watermark.position.top')],
      ['bottom-right', this.t('configModal.watermark.position.bottom')],
    ];
  },

  /*
   * 根据轴方向生成边距轴标签。适配本地化文案：
   * - 中文环境下对应"水平边距"/"垂直边距"
   * - 其他语言回退为 baseLabel + " X"/" Y"
   *
   * 当前未新增独立 i18n key，因为 paddingX/paddingY 仍使用原 padding 翻译 key，
   * 拆分后补充轴方向后缀即可。
   */
  watermarkPaddingAxisLabel(axis) {
    const baseLabel = this.t('configModal.watermark.padding');
    if (baseLabel === '边距') return axis === 'x' ? '水平边距' : '垂直边距';
    if (baseLabel === '邊距') return axis === 'x' ? '水平邊距' : '垂直邊距';
    return `${baseLabel} ${axis.toUpperCase()}`;
  },

  /*
   * 切换签名水印样式时，自动校正 position 为对应水印条的合法值。
   * 角落签名支持 9 位置，水印条只支持顶部或底部，防止出现空选项。
   */
  signatureWatermarkPositionForStyle(position, style) {
    if (style !== 'bar') return position;
    return String(position || '').startsWith('top') ? 'top-right' : 'bottom-right';
  },

  /*
   * 普通水印的尺寸标签根据类型和排列方式区分：
   * - 图片水印显示"图片尺寸"
   * - 平铺显示"平铺单元"
   * - 单个文字水印隐藏尺寸控件（size 字段 UI 不可见）
   *
   * 同样基于当前翻译匹配，未新增独立 i18n key。
   */
  normalWatermarkSizeLabel(type, arrangement) {
    const baseLabel = this.t('configModal.watermark.size');
    if (type === 'image') {
      if (baseLabel === '水印尺寸') return '图片尺寸';
      if (baseLabel === '浮水印尺寸') return '圖片尺寸';
      return 'Image size';
    }
    if (arrangement === 'tiled') {
      if (baseLabel === '水印尺寸') return '平铺单元';
      if (baseLabel === '浮水印尺寸') return '平鋪單元';
      return 'Tile cell';
    }
    return baseLabel;
  },
};
