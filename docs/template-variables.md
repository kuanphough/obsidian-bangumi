# Bangumi Sync Template Variables / 模板变量

`Subject note template` supports `{{variable_name}}` placeholders.  
`条目笔记模板` 支持 `{{variable_name}}` 占位符。

The template must include both `{{sync_block_start}}` and `{{sync_block_end}}`. On repeat syncs, the plugin updates frontmatter and the content between these markers, while keeping user-written content outside the sync block.  
模板必须包含 `{{sync_block_start}}` 和 `{{sync_block_end}}`。重复同步时，插件会更新 frontmatter 和这两个标记之间的同步块，并保留同步块之外的用户手写内容。

## Important Behavior / 重要行为

- Variables already used in your template are fetched automatically when possible. For example, using `{{summary_section}}` or `{{subject_summary}}` will trigger detailed subject info fetching.
- Settings under `Template data toggles / 模板数据开关` force extra data fetching even if the current template does not use those variables.
- Extra data such as staff, characters, and relations adds API requests and may slow sync.
- If an extra API request fails, note generation continues. Markdown variables become empty strings, JSON variables become empty arrays or objects, and the failure is recorded in the sync report.
- `bangumi_tags` means your personal collection tags. `subject_tags` means public Bangumi subject tags.
- Bangumi v0 episode collection APIs do not return user per-episode comments, so there is no single-episode comment variable.

- 模板里已经使用的变量会尽量自动拉取。例如使用 `{{summary_section}}` 或 `{{subject_summary}}` 会触发详细条目信息拉取。
- `Template data toggles / 模板数据开关` 会强制额外拉取数据，即使当前模板暂时没用到这些变量。
- Staff、Characters、Relations 等扩展数据会增加 API 请求，同步可能变慢。
- 扩展 API 请求失败不会阻止笔记生成。Markdown 变量会输出为空字符串，JSON 变量会输出空数组或空对象，并在同步报告里记录失败原因。
- `bangumi_tags` 是你的个人收藏标签；`subject_tags` 是 Bangumi 公共条目标签。
- Bangumi v0 章节收藏接口不返回用户单集评论，因此没有单集评论变量。

## Identity / 身份信息

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| `{{bangumi_id}}` | Bangumi subject ID. | Bangumi 条目 ID。 |
| `{{title}}` | Display title, preferring Chinese title when available. | 显示标题，优先中文名。 |
| `{{title_json}}` | JSON/YAML-safe display title. | 适合 JSON/YAML 的显示标题。 |
| `{{original_title}}` | Original Bangumi title. | 原名。 |
| `{{original_title_json}}` | JSON/YAML-safe original title. | 适合 JSON/YAML 的原名。 |
| `{{type}}` | Subject type: `book`, `anime`, `music`, `game`, or `real`. | 条目类型：`book`、`anime`、`music`、`game`、`real`。 |
| `{{status}}` | Collection status: `wish`, `collect`, `do`, `on_hold`, or `dropped`. | 收藏状态：`wish`、`collect`、`do`、`on_hold`、`dropped`。 |

## User Collection / 用户收藏信息

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| `{{rating}}` | Your rating. Empty when unrated. | 你的评分；未评分时为空。 |
| `{{updated_at}}` | Your collection update time. | 你的收藏更新时间。 |
| `{{updated_at_yaml}}` | YAML-safe collection update time. | 适合 YAML 的收藏更新时间。 |
| `{{bangumi_tags_json}}` | Your collection tags as JSON. | 你的收藏标签，JSON 数组。 |
| `{{comment}}` | Your collection comment. | 你的收藏短评。 |
| `{{comment_json}}` | JSON/YAML-safe collection comment. | 适合 JSON/YAML 的收藏短评。 |

## Subject Details / 条目详情

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| `{{eps_total}}` | Total episode count from Bangumi when available. | Bangumi 条目总集数/章节数。 |
| `{{air_date}}` | Subject air/release date. | 条目放送/发售日期。 |
| `{{air_date_yaml}}` | YAML-safe air/release date. | 适合 YAML 的日期。 |
| `{{subject_summary}}` | Subject summary text. Auto-fetches detailed subject info. | 条目简介。会自动拉取详细条目信息。 |
| `{{summary_section}}` | Rendered `## Summary` section. Empty when no summary exists. | 渲染好的 `## Summary` 段落；无简介时为空。 |
| `{{subject_infobox}}` | Rendered Markdown list from Bangumi infobox. | Bangumi infobox 渲染为 Markdown 列表。 |
| `{{subject_infobox_json}}` | Raw infobox as JSON. | 原始 infobox，JSON。 |
| `{{subject_tags}}` | Public subject tags with counts. | 公共条目标签及数量。 |
| `{{subject_tags_json}}` | Public subject tags as JSON. | 公共条目标签，JSON。 |
| `{{subject_rating}}` | Public score, total rating count, and rank. | 公共评分、评分人数和排名。 |
| `{{subject_rating_json}}` | Public rating data as JSON. | 公共评分数据，JSON。 |
| `{{subject_collection_stats}}` | Public wish/collect/doing/on-hold/dropped counts. | 全站收藏统计。 |
| `{{subject_collection_stats_json}}` | Public collection stats as JSON. | 全站收藏统计，JSON。 |

## Extended Lists / 扩展列表

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| `{{staff}}` | Rendered staff/person list. Auto-fetches staff. | 制作人员/人物列表。会自动拉取 Staff。 |
| `{{staff_json}}` | Staff/person list as JSON. | 制作人员/人物列表，JSON。 |
| `{{characters}}` | Rendered character list with actor names when available. Auto-fetches characters. | 角色列表，含可用的声优/演员。会自动拉取 Characters。 |
| `{{characters_json}}` | Character list as JSON. | 角色列表，JSON。 |
| `{{relations}}` | Rendered related subject list. Auto-fetches relations. | 关联条目列表。会自动拉取 Relations。 |
| `{{relations_json}}` | Related subject list as JSON. | 关联条目列表，JSON。 |

## Progress / 进度

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| `{{progress_done}}` | Completed episode count, based on episode collection `type > 0`. | 已完成章节数，按章节收藏 `type > 0` 统计。 |
| `{{progress_total}}` | Total valid fetched episode count, including main episodes and extra episode types such as SP/OP/ED/PV/MAD/Other. | 已拉取到的有效章节总数，包含本篇以及 SP/OP/ED/PV/MAD/Other 等额外章节类型。 |
| `{{progress_percent}}` | Integer percentage, rounded from `done / total * 100`. | 整数百分比，四舍五入。 |
| `{{progress_available}}` | `true` when episode progress was fetched and has valid episodes. | 成功拉到有效章节进度时为 `true`。 |
| `{{next_episode_json}}` | JSON/YAML-safe next unfinished episode label, or empty string. | 下一集/章节，适合 JSON/YAML；没有时为空字符串。 |
| `{{next_episode_sort}}` | Next unfinished episode sort number, or empty string. | 下一集/章节序号；没有时为空。 |
| `{{last_done_episode_json}}` | JSON/YAML-safe last completed episode label, or empty string. | 最后完成集/章节，适合 JSON/YAML；没有时为空。 |
| `{{last_done_episode_sort}}` | Last completed episode sort number, or empty string. | 最后完成集/章节序号；没有时为空。 |
| `{{progress}}` | Rendered Markdown episode checklist. | 渲染好的章节 checklist。 |

## Media And Tags / 媒体与标签

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| `{{cover}}` | Cover image URL. | 封面 URL。 |
| `{{cover_yaml}}` | YAML-safe cover image URL. | 适合 YAML 的封面 URL。 |
| `{{cover_image}}` | Markdown image syntax for the cover. | 封面 Markdown 图片语法。 |
| `{{tags_yaml}}` | YAML list containing `bangumi`, subject type, and collection status. | YAML 标签列表，包含 `bangumi`、条目类型和收藏状态。 |

## Sync Markers / 同步标记

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| `{{sync_block_start}}` | Required sync block start marker. | 必需的同步块开始标记。 |
| `{{sync_block_end}}` | Required sync block end marker. | 必需的同步块结束标记。 |

## Default Frontmatter Example / 默认 Frontmatter 示例

The built-in default keeps only basic lookup fields plus `progress_done`. More complete progress and extended subject data remain available for custom templates.  
内置默认模板只保留基础检索字段和 `progress_done`。更完整的进度字段和扩展条目数据仍可在自定义模板里手动使用。

```markdown
---
bangumi_id: {{bangumi_id}}
title: {{title_json}}
original_title: {{original_title_json}}
type: {{type}}
status: {{status}}
rating: {{rating}}
eps_total: {{eps_total}}
progress_done: {{progress_done}}
updated_at: {{updated_at_yaml}}
bangumi_tags: {{bangumi_tags_json}}
comment: {{comment_json}}
tags:
{{tags_yaml}}
cover: {{cover_yaml}}
---
```
