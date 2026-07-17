import assert from 'node:assert/strict';
import test from 'node:test';

import { LANGUAGE_OPTIONS } from '../../src/i18n/languageOptions.js';
import { enMessages } from '../../src/i18n/locales/en.js';
import { jaMessages } from '../../src/i18n/locales/ja.js';
import { koMessages } from '../../src/i18n/locales/ko.js';
import { LOCALE_MESSAGES, translate } from '../../src/i18n/messages.js';
import { zhCNMessages } from '../../src/i18n/locales/zhCN.js';
import { zhTWMessages } from '../../src/i18n/locales/zhTW.js';

const canonicalKeys = Object.keys(zhCNMessages);

test('every supported language provides the complete Simplified Chinese key set', () => {
  for (const [language] of LANGUAGE_OPTIONS) {
    const messages = LOCALE_MESSAGES[language];
    assert.ok(messages, `missing locale object for ${language}`);
    assert.deepEqual(
      Object.keys(messages).sort(),
      [...canonicalKeys].sort(),
      `${language} key drift`
    );

    for (const key of canonicalKeys) {
      assert.notEqual(messages[key], undefined, `${language} is missing ${key}`);
      assert.notEqual(String(messages[key]).trim(), '', `${language} has an empty ${key}`);
      assert.deepEqual(
        placeholders(messages[key]),
        placeholders(zhCNMessages[key]),
        `${language} changed placeholders for ${key}`
      );
    }
  }
});

test('source save guidance consistently uses Ctrl/Cmd+S', () => {
  for (const [language] of LANGUAGE_OPTIONS) {
    assert.match(translate(language, 'source.status.editable'), /Ctrl\/Cmd\+S/);
    assert.match(translate(language, 'source.status.dirty'), /Ctrl\/Cmd\+S/);
  }
});

test('advanced structure selection guidance no longer uses the old context-menu fallback', () => {
  for (const [language] of LANGUAGE_OPTIONS) {
    const message = translate(language, 'notice.structureSelectMulti');
    assert.notEqual(
      message,
      'Continue clicking topics to select, then finish through the context menu.'
    );
  }
});

test('cut confirmation is distinct from delete confirmation', () => {
  const message = translate('zh-CN', 'confirm.cutTopicWithDescendants', {
    topic: '父主题',
    count: 2,
  });
  assert.match(message, /剪切/);
  assert.doesNotMatch(message, /删除/);
  assert.match(message, /2 个子主题/);
});

test('English messages preserve finalized product behavior', () => {
  assert.match(enMessages['source.status.synced'], /mind map content/i);
  assert.match(enMessages['fullscreenDraftRecovery.copied'], /recoverable source/i);
  assert.match(enMessages['contextMenu.deleteMindMap'], /mind map/i);
  assert.match(
    enMessages['configModal.shortcuts.description.copyTopicWithAttributes'],
    /attributes.*subtopics/i
  );
  assert.match(enMessages['configModal.watermark.image.upload'], /import.*vault/i);
});

test('Traditional Chinese messages preserve finalized product behavior', () => {
  assert.match(zhTWMessages['source.status.synced'], /心智圖內容/);
  assert.match(zhTWMessages['fullscreenDraftRecovery.copied'], /可恢復的原始碼/);
  assert.match(zhTWMessages['contextMenu.deleteMindMap'], /心智圖/);
  assert.match(
    zhTWMessages['configModal.shortcuts.description.copyTopicWithAttributes'],
    /屬性.*子主題/
  );
  assert.match(zhTWMessages['configModal.watermark.image.upload'], /匯入.*儲存庫/);
});

test('Japanese messages preserve finalized product behavior', () => {
  assert.match(jaMessages['source.status.synced'], /マップ内容/);
  assert.match(jaMessages['fullscreenDraftRecovery.copied'], /復元可能なソース/);
  assert.match(jaMessages['contextMenu.deleteMindMap'], /マインドマップ/);
  assert.match(
    jaMessages['configModal.shortcuts.description.copyTopicWithAttributes'],
    /属性.*サブトピック/
  );
  assert.match(jaMessages['configModal.watermark.image.upload'], /保管庫.*インポート/);
});

test('Korean messages preserve finalized product behavior', () => {
  assert.match(koMessages['source.status.synced'], /맵 내용/);
  assert.match(koMessages['fullscreenDraftRecovery.copied'], /복구 가능한 소스/);
  assert.match(koMessages['contextMenu.deleteMindMap'], /마인드맵/);
  assert.match(
    koMessages['configModal.shortcuts.description.copyTopicWithAttributes'],
    /속성.*하위 주제/
  );
  assert.match(koMessages['configModal.watermark.image.upload'], /보관소.*가져오기/);
});

function placeholders(value) {
  return String(value).match(/\{[^}]+\}/g) || [];
}
