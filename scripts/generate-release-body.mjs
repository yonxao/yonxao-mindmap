/*
 * 文件作用：
 * 这个脚本负责生成 GitHub Release 正文。
 *
 * 执行逻辑：
 * 1. 从 manifest.json 读取当前发布版本。
 * 2. 从 CHANGELOG.md 抽取当前版本的变更段落。
 * 3. 写入 dist/release-body.md，供 GitHub Actions 发布 Release 时使用。
 *
 * 调用链位置：
 * package.json scripts.release:prepare -> scripts/generate-release-body.mjs -> dist/release-body.md
 */

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const manifestPath = path.join(projectRoot, 'manifest.json');
const packagePath = path.join(projectRoot, 'package.json');
const changelogPath = path.join(projectRoot, 'CHANGELOG.md');
const releaseBodyPath = path.join(distDir, 'release-body.md');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeRepositoryUrl(repository) {
  const rawUrl = typeof repository === 'string' ? repository : repository?.url;
  if (!rawUrl) return 'https://github.com/yonxao/yonxao-mindmap';

  return rawUrl
    .replace(/^git\+/, '')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '');
}

function parseVersionHeading(line) {
  const match = line.match(/^##\s+\[?([0-9]+\.[0-9]+\.[0-9]+[^\]\s]*)\]?(?:\s+-\s+(.+))?\s*$/);
  if (!match) return null;

  return {
    version: match[1],
    date: match[2] || '',
  };
}

function demoteMarkdownHeadings(markdown, levels) {
  return markdown.replace(/^(#{1,6})\s+/gm, (_match, hashes) => {
    const nextLevel = Math.min(hashes.length + levels, 6);
    return `${'#'.repeat(nextLevel)} `;
  });
}

function extractChangelogEntry(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const headings = [];

  lines.forEach((line, index) => {
    const heading = parseVersionHeading(line);
    if (heading) headings.push({ ...heading, index });
  });

  const currentHeadingIndex = headings.findIndex((heading) => heading.version === version);
  if (currentHeadingIndex === -1) {
    throw new Error(`CHANGELOG.md 中找不到版本 ${version} 的更新内容。`);
  }

  const currentHeading = headings[currentHeadingIndex];
  const nextHeading = headings[currentHeadingIndex + 1];
  const entryLines = lines
    .slice(currentHeading.index + 1, nextHeading ? nextHeading.index : lines.length)
    .join('\n')
    .trim();

  if (!entryLines) {
    throw new Error(`CHANGELOG.md 中版本 ${version} 的更新内容为空。`);
  }

  return {
    date: currentHeading.date,
    previousVersion: nextHeading?.version || '',
    body: demoteMarkdownHeadings(entryLines, 2),
  };
}

const manifest = readJson(manifestPath);
const packageJson = readJson(packagePath);
const version = manifest.version;
const repositoryUrl = normalizeRepositoryUrl(packageJson.repository);
const changelogUrl = `${repositoryUrl}/blob/main/CHANGELOG.md`;
const changelog = fs.readFileSync(changelogPath, 'utf8');
const changelogEntry = extractChangelogEntry(changelog, version);

const compareLine = changelogEntry.previousVersion
  ? `\n版本对比：[${changelogEntry.previousVersion}...${version}](${repositoryUrl}/compare/${changelogEntry.previousVersion}...${version})\n`
  : '';
const versionTitle = changelogEntry.date
  ? `#### ${version} - ${changelogEntry.date}`
  : `#### ${version}`;

const releaseBody = `## yonxao-mindmap

### 安装方式

1. 在 Obsidian 中打开 **设置 → 社区插件 → 浏览**，搜索 "yonxao-mindmap"。
2. 或手动下载压缩包，解压到 \`.obsidian/plugins/yonxao-mindmap/\`。

### 更新内容
${compareLine}
${versionTitle}

${changelogEntry.body}

完整更新日志请参阅 [CHANGELOG](${changelogUrl})。
`;

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(releaseBodyPath, releaseBody, 'utf8');

console.log(`Generated GitHub release body: ${releaseBodyPath}`);
