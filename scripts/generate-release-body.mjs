/*
 * 文件作用：
 * 这个脚本负责生成 GitHub Release 正文。
 *
 * 执行逻辑：
 * 1. 从 manifest.json 读取当前发布版本。
 * 2. 从 CHANGELOG.md 抽取当前版本的变更段落。
 * 3. 读取 .github/release-body.md 模板，填入当前版本更新内容。
 * 4. 写入 dist/release-body.md，供 GitHub Actions 发布 Release 时使用。
 *
 * 调用链位置：
 * package.json scripts.release:body -> scripts/generate-release-body.mjs -> dist/release-body.md
 */

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const manifestPath = path.join(projectRoot, 'manifest.json');
const packagePath = path.join(projectRoot, 'package.json');
const changelogPath = path.join(projectRoot, 'CHANGELOG.md');
const releaseBodyTemplatePath = path.join(projectRoot, '.github', 'release-body.md');
const releaseBodyPath = path.join(distDir, 'release-body.md');
const RELEASE_NOTES_PLACEHOLDER = '{{RELEASE_NOTES}}';
const CHANGELOG_URL_PLACEHOLDER = '{{CHANGELOG_URL}}';

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

/*
 * 用 .github/release-body.md 作为 GitHub Release 正文模板。
 *
 * 这样安装方式、固定说明等人工维护内容都写在 Markdown 里；
 * 脚本只负责把当前版本的 CHANGELOG 内容填到占位符位置。
 */
function renderReleaseBodyTemplate(template, replacements) {
  if (!template.includes(RELEASE_NOTES_PLACEHOLDER)) {
    throw new Error(`.github/release-body.md 缺少 ${RELEASE_NOTES_PLACEHOLDER} 占位符。`);
  }
  if (!template.includes(CHANGELOG_URL_PLACEHOLDER)) {
    throw new Error(`.github/release-body.md 缺少 ${CHANGELOG_URL_PLACEHOLDER} 占位符。`);
  }

  return template
    .split(RELEASE_NOTES_PLACEHOLDER)
    .join(replacements.releaseNotes)
    .split(CHANGELOG_URL_PLACEHOLDER)
    .join(replacements.changelogUrl);
}

const manifest = readJson(manifestPath);
const packageJson = readJson(packagePath);
const version = manifest.version;
const repositoryUrl = normalizeRepositoryUrl(packageJson.repository);
const changelogUrl = `${repositoryUrl}/blob/main/CHANGELOG.md`;
const changelog = fs.readFileSync(changelogPath, 'utf8');
const releaseBodyTemplate = fs.readFileSync(releaseBodyTemplatePath, 'utf8');
const changelogEntry = extractChangelogEntry(changelog, version);

const compareBlock = changelogEntry.previousVersion
  ? `版本对比：[${changelogEntry.previousVersion}...${version}](${repositoryUrl}/compare/${changelogEntry.previousVersion}...${version})\n\n`
  : '';
const versionTitle = changelogEntry.date
  ? `#### ${version} - ${changelogEntry.date}`
  : `#### ${version}`;
const releaseNotes = `${compareBlock}${versionTitle}\n\n${changelogEntry.body}`;
const releaseBody = renderReleaseBodyTemplate(releaseBodyTemplate, {
  releaseNotes,
  changelogUrl,
});

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(releaseBodyPath, releaseBody, 'utf8');

console.log(`Generated GitHub release body: ${releaseBodyPath}`);
