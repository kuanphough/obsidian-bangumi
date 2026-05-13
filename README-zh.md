# Bangumi Sync

[English](README.md) | 中文文档

用于将 Bangumi 动画收藏和章节进度同步到 Obsidian Markdown 笔记的插件。

## 使用方法

1. 将插件安装或构建到 Obsidian 库的插件目录中。
2. 在 Obsidian 中启用插件。
3. 在 <https://next.bgm.tv/demo/access-token/create> 创建 Bangumi access token。
4. 打开插件设置，将 token 粘贴到 `Access token`。
   只粘贴 token 本身，不要添加 `Bearer`。
5. 可选填写 Bangumi 用户名。如果留空，插件会使用 `/v0/me` 自动识别当前用户。
6. 选择要同步的收藏状态，然后点击左侧栏图标，或运行命令 `Bangumi Sync: Sync now`。

### Access Token

获取 token 的步骤：

1. 打开 <https://next.bgm.tv/demo/access-token/create>。
2. 如果页面要求登录，请先登录 Bangumi。
3. 创建一个新的 access token。
4. 复制生成的 token。
5. 将它粘贴到插件设置里的 `Access token`。

请妥善保管 token。它会授权插件读取你的 Bangumi 账号数据。

默认情况下，笔记会创建在 `Bangumi/Anime` 目录下。每个文件名都会包含 Bangumi 条目 ID，例如 `Title [bgm-123].md`，避免同名条目互相覆盖。

## 同步行为

- 目前只同步动画条目（`subject_type=2`）。
- 会分页拉取所有已选择的收藏状态。
- 如果可用，会同步每个条目的章节进度。
- 会写入 Bangumi 元数据、用户评分、用户标签、用户评论、封面和章节 checklist。
- 重复同步时，只更新 `<!-- bangumi-sync-start -->` 到 `<!-- bangumi-sync-end -->` 之间的同步块。
- 同步块之外的内容会保留，包括用于长期记录的 `## Notes`。
- 如果某个条目同步失败，会继续同步其他条目，并在结束后报告问题数量。

## 开发

```bash
npm install
npm run build
```

如果 Windows PowerShell 的执行策略阻止 `npm.ps1`，可以使用 `npm.cmd`。

## 当前限制

- 暂未实现 OAuth 登录，需要手动粘贴 access token。
- 暂未实现自定义模板和 Daily Notes 同步。
- 当前 MVP 只同步动画收藏。

## Roadmap

### 稳定 MVP

- 使用真实 Bangumi token，在真实 Obsidian 库中测试完整同步流程。
- 改进 token 过期、权限不足、Bangumi API 限流等错误提示。
- 为 Markdown 渲染、同步块合并、重复文件防护添加轻量测试。
- 在设置页添加手动 `Test token` 操作，方便在完整同步前检查配置。

### 改善同步体验

- 显示更清晰的同步进度和结束详情，包括哪些条目同步失败。
- 支持动画以外的可配置条目类型，例如书籍、音乐、游戏和三次元。
- 增加文件命名、文件夹分组、是否包含搁置/抛弃条目的选项。
- 在 Bangumi API 支持的范围内，基于上次同步时间实现增量同步。

### 笔记与模板

- 增加用户可编辑的 Markdown 条目笔记模板。
- 支持自定义 frontmatter 字段，方便配合 Dataview 使用。
- 为想编辑部分生成内容的用户提供更安全的合并策略。
- 可选按状态、年份、标签或条目类型创建索引笔记。

### 账号与发布

- 增加 OAuth 登录，让用户不必手动创建和粘贴 access token。
- 增加发布打包说明，说明 `manifest.json`、`main.js` 和可选 `styles.css` 的发布方式。
- 增加版本号更新和发布 checklist，为发布到 Obsidian 社区插件做准备。
- 检查移动端兼容性，并记录任何仅桌面端可用的限制。
