/*
 * 文件作用：
 * 配置对象访问、克隆、路径写入和普通对象合并工具。
 */

export function mergeMindConfigObjects(baseConfig, overrideConfig) {
  return deepMergePlainObjects(
    isPlainObject(baseConfig) ? baseConfig : {},
    isPlainObject(overrideConfig) ? overrideConfig : {}
  );
}

export function setMindConfigPath(rawConfig, path, value) {
  const next = clonePlainObject(rawConfig);
  let current = next;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    if (!isPlainObject(current[key])) current[key] = {};
    current = current[key];
  }

  current[path[path.length - 1]] = value;
  return next;
}

/*
 * 作用：
 * 删除配置对象中的某条路径，并清理空父级。
 *
 * 调用场景：
 * 用户双击高度拖拽条恢复自动高度时，删除 canvas.height。
 */
export function deleteMindConfigPath(rawConfig, path) {
  const next = clonePlainObject(rawConfig);
  const parents = [];
  let current = next;

  for (const key of path.slice(0, -1)) {
    if (!isPlainObject(current[key])) return next;
    parents.push([current, key]);
    current = current[key];
  }

  delete current[path[path.length - 1]];

  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const [parent, key] = parents[index];
    if (isPlainObject(parent[key]) && !Object.keys(parent[key]).length) {
      delete parent[key];
    }
  }

  return next;
}

export function clonePlainObject(value) {
  if (!isPlainObject(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

/*
 * 作用：
 * 写入可选配置值；空值不写，从而保持配置区简洁。
 */
export function setConfigValueIfPresent(config, path, value) {
  if (value === undefined || value === null || value === '') return config;

  let current = config;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    if (!isPlainObject(current[key])) current[key] = {};
    current = current[key];
  }

  current[path[path.length - 1]] = value;
  return config;
}

/*
 * 作用：
 * 递归合并两个普通对象，并且始终返回全新的对象引用。
 *
 * 关键变量：
 * - merged：先复制 base，保证不会修改调用方传入的全局配置对象。
 * - overrideValue：当前覆盖字段；只有它和 baseValue 都是普通对象时才继续深入合并。
 */
export function deepMergePlainObjects(base, override) {
  const merged = clonePlainObject(base);

  for (const [key, overrideValue] of Object.entries(override)) {
    if (overrideValue === undefined) continue;

    const baseValue = merged[key];
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      merged[key] = deepMergePlainObjects(baseValue, overrideValue);
    } else if (isPlainObject(overrideValue)) {
      merged[key] = clonePlainObject(overrideValue);
    } else {
      merged[key] = overrideValue;
    }
  }

  return merged;
}

/*
 * 作用：
 * 判断一个值是否为普通对象。
 */
export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
