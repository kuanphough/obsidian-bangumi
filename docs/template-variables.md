# Subject Note Template Variables

The `Subject note template` setting supports `{{variable_name}}` placeholders.

The template must include both `{{sync_block_start}}` and `{{sync_block_end}}`. On repeat syncs, the plugin updates the frontmatter and the content between those markers while keeping the rest of the note.

## Identity

| Variable | Description |
| --- | --- |
| `{{bangumi_id}}` | Bangumi subject ID. |
| `{{title}}` | Display title, preferring Chinese title when available. |
| `{{title_json}}` | JSON/YAML-safe title string. |
| `{{original_title}}` | Original Bangumi title. |
| `{{original_title_json}}` | JSON/YAML-safe original title string. |
| `{{type}}` | Subject type label: `book`, `anime`, `music`, `game`, or `real`. |
| `{{status}}` | Collection status label: `wish`, `collect`, `do`, `on_hold`, or `dropped`. |

## Collection Metadata

| Variable | Description |
| --- | --- |
| `{{rating}}` | User rating. Empty when unrated. |
| `{{eps_total}}` | Total episode count from Bangumi, when available. |
| `{{air_date}}` | Subject air/release date. |
| `{{air_date_yaml}}` | YAML-safe air/release date. |
| `{{updated_at}}` | Collection update time. |
| `{{updated_at_yaml}}` | YAML-safe collection update time. |
| `{{bangumi_tags_json}}` | User collection tags as a JSON array. |
| `{{comment}}` | User collection comment. |
| `{{comment_json}}` | JSON/YAML-safe user collection comment. |

## Progress

| Variable | Description |
| --- | --- |
| `{{progress_done}}` | Completed episode count, based on episode collection `type > 0`. |
| `{{progress_total}}` | Total episode count, preferring subject `eps`, then fetched episode count. |
| `{{progress_percent}}` | Integer percentage, rounded from `done / total * 100`. |
| `{{progress_available}}` | `true` when episode progress was fetched and has valid episodes, otherwise `false`. |
| `{{next_episode_json}}` | JSON/YAML-safe next unfinished episode label, or empty string. |
| `{{next_episode_sort}}` | Next unfinished episode sort number, or empty string. |
| `{{last_done_episode_json}}` | JSON/YAML-safe last completed episode label, or empty string. |
| `{{last_done_episode_sort}}` | Last completed episode sort number, or empty string. |
| `{{progress}}` | Rendered Markdown episode checklist for the sync block. |

## Media And Tags

| Variable | Description |
| --- | --- |
| `{{cover}}` | Cover image URL. |
| `{{cover_yaml}}` | YAML-safe cover image URL. |
| `{{cover_image}}` | Markdown image syntax for the cover. |
| `{{tags_yaml}}` | YAML list containing `bangumi`, subject type, and collection status. |

## Sync Markers

| Variable | Description |
| --- | --- |
| `{{sync_block_start}}` | Required sync block start marker. |
| `{{sync_block_end}}` | Required sync block end marker. |

## Default Frontmatter Example

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
progress_total: {{progress_total}}
progress_percent: {{progress_percent}}
progress_available: {{progress_available}}
next_episode: {{next_episode_json}}
next_episode_sort: {{next_episode_sort}}
last_done_episode: {{last_done_episode_json}}
last_done_episode_sort: {{last_done_episode_sort}}
air_date: {{air_date_yaml}}
updated_at: {{updated_at_yaml}}
bangumi_tags: {{bangumi_tags_json}}
comment: {{comment_json}}
tags:
{{tags_yaml}}
cover: {{cover_yaml}}
---
```
