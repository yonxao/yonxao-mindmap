/*
 * 文件作用：
 * 定义跨宿主共享的内置主题、自动配色和主题/连线颜色优先级。
 */

export const DEFAULT_THEME_NAME = 'default';
export const MIND_THEME_NAMES = Object.freeze([
  'default',
  'ocean',
  'forest',
  'sunset',
  'mono',
  'rainbow',
  'pastel-rainbow',
  'neon-rainbow',
] as const);
export const RAINBOW_THEME_NAMES = Object.freeze([
  'rainbow',
  'pastel-rainbow',
  'neon-rainbow',
] as const);

export type MindThemeName = (typeof MIND_THEME_NAMES)[number];
export type MindThemeMode = 'none' | 'single' | 'branch' | 'level';

export interface MindThemeDefinition {
  readonly mode: MindThemeMode;
  readonly centerColor: string;
  readonly palette: readonly string[];
  readonly fillAlpha: number;
  readonly connectorOpacity: number;
}

export interface ThemeTopic {
  id?: string;
  level?: number;
  attributes?: {
    color?: unknown;
  };
}

export interface ThemeConfig {
  theme?: unknown;
  topic?: {
    defaultColor?: unknown;
  };
}

export const MIND_THEMES: Readonly<Record<MindThemeName, MindThemeDefinition>> = Object.freeze({
  default: Object.freeze({
    mode: 'none',
    centerColor: '',
    palette: Object.freeze([]),
    fillAlpha: 0.11,
    connectorOpacity: 0.62,
  }),
  ocean: Object.freeze({
    mode: 'branch',
    centerColor: '#1d4ed8',
    palette: Object.freeze(['#2563eb', '#0ea5e9', '#06b6d4', '#14b8a6', '#6366f1']),
    fillAlpha: 0.12,
    connectorOpacity: 0.68,
  }),
  forest: Object.freeze({
    mode: 'branch',
    centerColor: '#15803d',
    palette: Object.freeze(['#16a34a', '#22c55e', '#059669', '#84cc16', '#0f766e']),
    fillAlpha: 0.12,
    connectorOpacity: 0.66,
  }),
  sunset: Object.freeze({
    mode: 'branch',
    centerColor: '#dc2626',
    palette: Object.freeze(['#f97316', '#ef4444', '#f59e0b', '#ec4899', '#a855f7']),
    fillAlpha: 0.13,
    connectorOpacity: 0.66,
  }),
  mono: Object.freeze({
    mode: 'level',
    centerColor: '#27272a',
    palette: Object.freeze(['#52525b', '#71717a', '#3f3f46', '#6b7280', '#475569']),
    fillAlpha: 0.09,
    connectorOpacity: 0.5,
  }),
  rainbow: Object.freeze({
    mode: 'branch',
    centerColor: '#2563eb',
    palette: Object.freeze([
      '#ef4444',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#06b6d4',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
    ]),
    fillAlpha: 0.12,
    connectorOpacity: 0.7,
  }),
  'pastel-rainbow': Object.freeze({
    mode: 'branch',
    centerColor: '#818cf8',
    palette: Object.freeze([
      '#f87171',
      '#fb923c',
      '#facc15',
      '#86efac',
      '#67e8f9',
      '#93c5fd',
      '#c4b5fd',
      '#f9a8d4',
    ]),
    fillAlpha: 0.1,
    connectorOpacity: 0.6,
  }),
  'neon-rainbow': Object.freeze({
    mode: 'branch',
    centerColor: '#00c7be',
    palette: Object.freeze([
      '#ff2d55',
      '#ff9f0a',
      '#ffd60a',
      '#32d74b',
      '#00c7be',
      '#0a84ff',
      '#bf5af2',
      '#ff375f',
    ]),
    fillAlpha: 0.14,
    connectorOpacity: 0.76,
  }),
});

export function normalizeMindThemeName(themeName: unknown): MindThemeName {
  const value = String(themeName || '')
    .trim()
    .toLowerCase();
  return Object.prototype.hasOwnProperty.call(MIND_THEMES, value)
    ? (value as MindThemeName)
    : DEFAULT_THEME_NAME;
}

export function getMindTheme(config: ThemeConfig | null | undefined): MindThemeDefinition {
  return MIND_THEMES[normalizeMindThemeName(config?.theme)];
}

export function themeColorForTopic(
  topic: ThemeTopic | null | undefined,
  config: ThemeConfig | null | undefined
): string {
  const theme = getMindTheme(config);
  if (isRootTopic(topic)) return theme.centerColor;
  if (!theme.palette.length || theme.mode === 'none') return '';
  if (theme.mode === 'single') return theme.palette[0] || '';

  if (theme.mode === 'level') {
    return colorFromPalette(theme.palette, Math.max(0, Number(topic?.level || 1) - 1));
  }
  return colorFromPalette(theme.palette, rootBranchIndex(topic));
}

export function themeTopicFillAlpha(config: ThemeConfig | null | undefined): number {
  return getMindTheme(config).fillAlpha;
}

export function themeConnectorOpacity(config: ThemeConfig | null | undefined): number {
  return getMindTheme(config).connectorOpacity;
}

/*
 * 主题属性只强调当前主题；父子连线刻意忽略该字段，保持整条分支的配色节奏。
 */
export function resolveTopicColor(
  topic: ThemeTopic,
  config: ThemeConfig | null | undefined
): string {
  return (
    normalizeMindColor(topic.attributes?.color) ||
    normalizeMindColor(config?.topic?.defaultColor) ||
    normalizeMindColor(themeColorForTopic(topic, config))
  );
}

export function resolveConnectorColor(
  topic: ThemeTopic,
  config: ThemeConfig | null | undefined
): string {
  return (
    normalizeMindColor(config?.topic?.defaultColor) ||
    normalizeMindColor(themeColorForTopic(topic, config))
  );
}

export function normalizeMindColor(color: unknown): string {
  const value = String(color || '').trim();
  if (!value) return '';
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) return value;
  if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) return `#${value}`;
  if (/^[a-z][a-z0-9-]*$/i.test(value)) return value;
  return '';
}

function colorFromPalette(palette: readonly string[], index: number): string {
  if (!palette.length) return '';
  return palette[Math.abs(index) % palette.length] || '';
}

function rootBranchIndex(topic: ThemeTopic | null | undefined): number {
  const parts = String(topic?.id || '').split('.');
  if (parts.length < 2) return 0;
  const index = Number(parts[1]);
  return Number.isFinite(index) ? index : 0;
}

function isRootTopic(topic: ThemeTopic | null | undefined): boolean {
  return String(topic?.id || '') === '0' || Number(topic?.level || 1) <= 1;
}
