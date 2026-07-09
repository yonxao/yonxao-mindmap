/*
 * 文件作用：
 * 这里提供配置面板使用的“草稿配置”工具函数。
 *
 * 为什么单独拆出来：
 * ConfigModal 负责界面交互；这里负责对象读写、清空字段和 YAML 文本转换。
 * 这样后续配置项变多时，不需要把大量数据处理逻辑塞进 UI 文件。
 *
 * 调用链：
 * ConfigModal -> getConfigValue()/setConfigValue()/deleteConfigValue()/parseDraftConfigText()
 */

import { parseSimpleYaml, stringifySimpleYaml } from './yamlConfig.js';

/*
 * 作用：
 * 深拷贝配置对象，避免弹框编辑时直接改动 renderer.rawConfig。
 */
export function cloneConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return {};
  return JSON.parse(JSON.stringify(config));
}

/*
 * 作用：
 * 按路径读取嵌套配置值，例如 ['font', 'level1', 'size']。
 */
export function getConfigValue(config, path, fallback = '') {
  let current = config;
  for (const key of path) {
    if (!current || typeof current !== 'object') return fallback;
    current = current[key];
  }

  return current === undefined || current === null ? fallback : current;
}

/*
 * 作用：
 * 按路径写入嵌套配置值；空值会删除该路径，避免配置区堆积无意义字段。
 */
export function setConfigValue(config, path, value) {
  if (value === '' || value === null || value === undefined) {
    deleteConfigValue(config, path);
    return config;
  }

  let current = config;
  for (const key of path.slice(0, -1)) {
    if (!(current[key] && typeof current[key] === 'object') || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }

  current[path[path.length - 1]] = value;
  return config;
}

/*
 * 作用：
 * 删除某个配置路径，并向上清理空对象。
 */
export function deleteConfigValue(config, path) {
  const parents = [];
  let current = config;

  for (const key of path.slice(0, -1)) {
    if (!current || typeof current !== 'object') return config;
    parents.push([current, key]);
    current = current[key];
  }

  if (current && typeof current === 'object') {
    delete current[path[path.length - 1]];
  }

  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const [parent, key] = parents[index];
    if (parent[key] && typeof parent[key] === 'object' && !Object.keys(parent[key]).length) {
      delete parent[key];
    }
  }

  return config;
}

/*
 * 作用：
 * 把文本输入转成数字；空值保留为空字符串，交给 setConfigValue 删除。
 */
export function numberFromInput(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
}

/*
 * 作用：
 * 把高级配置 YAML 文本解析成配置对象。
 */
export function parseDraftConfigText(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return {};
  return parseSimpleYaml(normalized.split(/\r?\n/));
}

/*
 * 作用：
 * 把配置草稿转换成高级配置文本。
 */
export function stringifyDraftConfig(config) {
  return stringifySimpleYaml(config || {});
}
