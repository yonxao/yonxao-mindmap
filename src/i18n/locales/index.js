import { deMessages } from './de.js';
import { enMessages } from './en.js';
import { esMessages } from './es.js';
import { frMessages } from './fr.js';
import { hiMessages } from './hi.js';
import { idMessages } from './id.js';
import { itMessages } from './it.js';
import { jaMessages } from './ja.js';
import { koMessages } from './ko.js';
import { ptBRMessages } from './ptBR.js';
import { ruMessages } from './ru.js';
import { thMessages } from './th.js';
import { trMessages } from './tr.js';
import { viMessages } from './vi.js';
import { zhCNMessages } from './zhCN.js';
import { zhTWMessages } from './zhTW.js';

// 每种语言都维护完整键集合；此处只负责建立语言代码到语言包的映射。
export const LOCALE_MESSAGES = Object.freeze({
  en: enMessages,
  'zh-CN': zhCNMessages,
  'zh-TW': zhTWMessages,
  ja: jaMessages,
  ko: koMessages,
  fr: frMessages,
  de: deMessages,
  es: esMessages,
  'pt-BR': ptBRMessages,
  ru: ruMessages,
  it: itMessages,
  id: idMessages,
  tr: trMessages,
  vi: viMessages,
  th: thMessages,
  hi: hiMessages,
});
