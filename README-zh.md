# Bangumi Sync

[English](README.md) | 中文文档

用于将 Bangumi 收藏和进度同步到 Obsidian Markdown 笔记的插件。

## 使用方法

1. 将插件安装或构建到 Obsidian 库的插件目录中。
2. 在 Obsidian 中启用插件。
3. 打开插件设置，点击 `打开 token 页面`，登录 Bangumi，创建 token 并复制。
4. 点击插件设置里的 `从剪贴板填入`，或手动把 token 粘贴到 `Access token`。
5. 插件会自动同步保存的 token 所属的 Bangumi 账号。
6. 选择存储逻辑、文件命名格式、条目类型和收藏状态，然后点击左侧栏图标，或运行命令 `Bangumi Sync: Sync now`。

插件会跟随 Obsidian 的应用语言。简体中文和繁体中文显示中文界面，其他语言显示英文界面。

Bangumi `User-Agent` 会自动生成，格式为 `Kuanphough/bangumi-sync/<插件版本号> (Obsidian Plugin)`，用户无需手动配置。

## Access Token

1. 打开 <https://next.bgm.tv/demo/access-token/create>。
2. 如果页面要求登录，请先登录 Bangumi。
3. 创建一个新的 access token。
4. 复制生成的 token。
5. 点击插件设置里的 `从剪贴板填入`，或将它手动粘贴到 `Access token`。

请妥善保管 token。它会授权插件读取你的 Bangumi 账号数据。设置页里的 token 输入框会以密码字段显示。

默认情况下，笔记会创建在 `Bangumi` 目录下。每个文件名都会包含 Bangumi 条目 ID，例如 `Title [bgm-123].md`，避免同名条目互相覆盖。

## 文件命名

`File name format` 设置支持：

- `Title [bgm-id]`：例如 `Title [bgm-123].md`。
- `[bgm-id] Title`：例如 `[bgm-123] Title.md`。
- `Bangumi ID only`：例如 `bgm-123.md`。

## 存储逻辑

`Storage layout` 设置用于控制同步笔记的创建位置：

- `No categories`：不分类，所有同步笔记都直接存放在同步目录下。
- `By subject type`：按条目类型分类，路径为 `同步目录 / 条目类型 / 收藏状态`。
- `By collection status`：按收藏状态分类，路径为 `同步目录 / 收藏状态 / 条目类型`。

条目类型文件夹使用 `book`、`anime`、`music`、`game` 和 `real`。收藏状态文件夹使用 `wish`、`collect`、`do`、`on_hold` 和 `dropped`。

## 同步行为

- 会同步已选择的条目类型：书籍（`1`）、动画（`2`）、音乐（`3`）、游戏（`4`）和三次元（`6`）。
- 会分页拉取所有已选择的收藏状态。
- 除非开启 `Include on hold/dropped`，否则会跳过搁置和抛弃状态。
- 开启增量同步时，会根据 Bangumi `updated_at` 和上次成功同步时间跳过未变化条目。章节进度拉取失败不会在笔记已写入后阻止同步时间推进。
- 如果可用，会同步每个条目的章节进度。
- 会写入 Bangumi 元数据、用户评分、用户标签、用户评论、封面、适合 Obsidian Base 使用的进度字段和章节 checklist。
- 同步过程中只显示开始、条目类型/收藏状态汇总和结束提示；如果出现问题，会写入 `Bangumi Sync Report.md`。
- 重复同步时，会更新 frontmatter 和 `<!-- bangumi-sync-start -->` 到 `<!-- bangumi-sync-end -->` 之间的同步块。
- 同步块之外的内容会保留，包括用于长期记录的 `## Notes`。
- 如果某个条目同步失败，会继续同步其他条目，并在结束后报告问题数量。

## 笔记模板

`Subject note template` 设置可以自定义每个同步条目的 Markdown 内容。

模板必须包含 `{{sync_block_start}}` 和 `{{sync_block_end}}`。如果缺少任意一个标记，插件会回退到内置默认模板，避免重复同步时覆盖手写笔记。

默认 frontmatter 会写入适合 Obsidian Base 和 Dataview 使用的进度字段：`progress_done`、`progress_total`、`progress_percent`、`progress_available`、`next_episode`、`next_episode_sort`、`last_done_episode` 和 `last_done_episode_sort`。

当前使用的 Bangumi v0 章节收藏接口不返回用户对单集的评论文本，因此暂不同步单集评论。

常用变量：

- `{{title}}`、`{{title_json}}`
- `{{original_title}}`、`{{original_title_json}}`
- `{{type}}`、`{{status}}`、`{{rating}}`、`{{eps_total}}`
- `{{progress_done}}`、`{{progress_total}}`、`{{progress_percent}}`、`{{progress_available}}`
- `{{next_episode_json}}`、`{{next_episode_sort}}`
- `{{last_done_episode_json}}`、`{{last_done_episode_sort}}`
- `{{air_date_yaml}}`、`{{updated_at_yaml}}`
- `{{bangumi_tags_json}}`、`{{comment_json}}`
- `{{cover}}`、`{{cover_yaml}}`、`{{cover_image}}`
- `{{tags_yaml}}`、`{{progress}}`
- `{{sync_block_start}}`、`{{sync_block_end}}`

## 开发

```bash
npm install
npm run build
```

如果 Windows PowerShell 的执行策略阻止 `npm.ps1`，可以使用 `npm.cmd`。

## 当前限制

- 暂不暴露 OAuth 登录，因为它需要用户创建自己的 Bangumi OAuth 应用。
- 暂未实现 Daily Notes 同步。
- 当前 Bangumi v0 章节收藏接口不返回用户单集评论，因此无法同步单集评论。

## Roadmap

### 稳定 MVP

- [x] 使用真实 Bangumi token，在真实 Obsidian 库中测试完整同步流程。
- [x] 改进 token 过期、权限不足、Bangumi API 限流等错误提示。
- [ ] 为 Markdown 渲染、同步块合并、重复文件防护添加轻量测试。
- [ ] 在设置页添加手动 `Test token` 操作，方便在完整同步前检查配置。

### 改善同步体验

- [x] 显示更清晰的同步进度和结束详情，包括哪些条目同步失败。
- [x] 支持动画以外的可配置条目类型，例如书籍、音乐、游戏和三次元。
- [x] 增加文件命名、是否包含搁置/抛弃条目的选项。
- [x] 在 Bangumi API 支持的范围内，基于上次同步时间实现增量同步。

### 笔记与模板

- [x] 增加用户可编辑的 Markdown 条目笔记模板。
- [x] 写入适合 Obsidian Base 使用的 frontmatter 进度字段。
- [ ] 支持自定义 frontmatter 字段，方便配合 Dataview 使用。
- [ ] 为想编辑部分生成内容的用户提供更安全的合并策略。
- [ ] 可选按状态、年份、标签或条目类型创建索引笔记。

### 账号与发布

- [x] 增加 token 获取页面和剪贴板填入辅助，减少手动配置步骤。
- [ ] 如果之后有不需要用户管理 client secret 的公共客户端流程，再重新评估 OAuth 登录。
- [ ] 增加发布打包说明，说明 `manifest.json`、`main.js` 和可选 `styles.css` 的发布方式。
- [ ] 增加版本号更新和发布 checklist，为发布到 Obsidian 社区插件做准备。
- [ ] 检查移动端兼容性，并记录任何仅桌面端可用的限制。
