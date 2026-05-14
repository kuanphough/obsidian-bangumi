# Bangumi Sync

English | [中文文档](README.md)

## One-line Introduction

Bangumi Sync is an Obsidian plugin for turning Bangumi collections into local notes. It supports multiple subject types, collection-status filters, episode progress, incremental sync, Daily Note sync blocks, and user-editable templates.

## Features

- Sync Bangumi books, anime, music, games, and real-life media.
- Filter by collection status: wish, collected, doing, on hold, and dropped.
- Incremental sync with missing local note recovery.
- Sync rating, tags, comment, cover, episode checklist, and lightweight `progress_done`.
- Preserve handwritten content outside the generated sync block.
- Optionally write newly synced in-progress subjects to today's Daily Note.
- Customize subject note templates and frontmatter fields.
- Generate `Bangumi Sync Report.md` when issues occur.

## Screenshots

### Basic Features

![Basic features](79c60d80-5b63-4ac7-8885-ee75eff7727e.png)

### Category-based Sync

![Category-based sync](daeae350-b7b9-42a4-b18f-57eea8c1d36e.png)

### Note Template

![Note template](fd599c5f-c9be-4add-8f89-538fceae5bd4.png)

### Subject Notes

![Subject note](a3de6bc4-a41b-40aa-8459-44377ecddf77.png) ![Subject note details](3e1b5ea0-f53d-42a9-b945-d8577eea9802.png)

### Daily Note Preview

![Daily Note preview](QQ_1778751638574.png)

## Installation

### Manual Installation

1. Download `manifest.json` and `main.js` from a release.
2. Create `.obsidian/plugins/bangumi-sync/` in your vault.
3. Put `manifest.json` and `main.js` into that folder.
4. Restart Obsidian or reload community plugins.
5. Enable `Bangumi Sync` in Settings → Community plugins.

### BRAT

If you use [BRAT](https://github.com/TfTHacker/obsidian42-brat) to install beta/development plugins:

1. Install and enable BRAT in Obsidian.
2. Open the command palette and run `BRAT: Add a beta plugin for testing`.
3. Enter this repository, for example `Kuanphough/bangumi-sync`, or the full GitHub URL.
4. After BRAT downloads the plugin, enable `Bangumi Sync` in Community plugins.

BRAT is intended for testing development builds. After a stable release is available, most users should prefer Obsidian Community plugins or GitHub release attachments.

## Getting Started

1. Open plugin settings and click `Open token page`.
2. Log in to Bangumi, create an access token, and copy it.
3. Return to Obsidian and click `Fill from clipboard`, or paste it into `Access token`.
4. Click `Test token` to verify the configuration.
5. Choose sync directory, storage layout, file name format, subject types, and collection statuses.
6. Click the ribbon icon or run `Bangumi Sync: Sync now`.

The plugin automatically syncs the Bangumi account that owns the saved token. Username is not required. `User-Agent` is generated from the plugin version.

## Access Token

Token page: <https://next.bgm.tv/demo/access-token/create>

Keep the token private. It authorizes the plugin to read your Bangumi account data. The token input is displayed as a password field.

## Settings

| Setting | Description |
| --- | --- |
| `Access token` | Bangumi access token. Paste manually or fill from clipboard. |
| `Sync directory` | Root folder for synced notes. Default: `Bangumi`. |
| `Storage layout` | Store notes flat, by subject type, or by collection status. |
| `File name format` | File name format. Default: `Title [bgm-id].md`. |
| `Include on hold/dropped` | Whether to sync on-hold and dropped subjects. |
| `Incremental sync` | Skip unchanged subjects by Bangumi updated time and recreate missing local notes. |
| `Daily note sync` | Write newly added or updated in-progress subjects to today's Daily Note block. |
| `Subject note template` | Customize the Markdown template for subject notes. |

## Sync Behavior

- Repeat syncs update frontmatter and the block between `<!-- bangumi-sync-start -->` and `<!-- bangumi-sync-end -->`.
- Content outside the sync block is preserved, including `## Notes`.
- Full sync compares rendered content before writing, so unchanged files are not touched.
- Episode progress failures do not block note generation; reports show that progress content was not fetched.
- One failed subject does not stop the whole sync. Issues are summarized at the end.

## Note Template

`Subject note template` must include:

```markdown
{{sync_block_start}}
{{sync_block_end}}
```

The default frontmatter keeps basic lookup fields plus `progress_done`. Fuller progress variables such as `progress_total`, `progress_percent`, next episode, and last completed episode are still available for custom templates.

See [Subject Note Template Variables](docs/template-variables.md) for the full variable reference. The settings button also creates and opens a local `Template Variables.md` file under your sync directory.

## Daily Note Sync

After enabling `Daily note sync`, add these markers to your Daily Note template:

```markdown
<!-- bangumi-daily-sync-start -->
<!-- bangumi-daily-sync-end -->
```

The plugin only writes between those markers, for example:

```markdown
- [x] [Title](https://bgm.tv/subject/611077) 进度：1/24 ✅ 2026-05-14
```

In incremental sync, only subjects actually written or updated in this run are added.

## Current Limits

- OAuth login is not supported yet; use manual access tokens.
- Bangumi's current v0 episode collection endpoint does not return per-episode comment text.
- This plugin is desktop-first. Mobile compatibility may be limited, especially clipboard access, token page opening, Daily Note path detection, and large settings textareas.

## Support

When reporting an issue, please include:

- Obsidian version and plugin version
- Selected subject types and collection statuses
- Relevant errors from `Bangumi Sync Report.md`
- Reproduction steps

See [Roadmap](docs/roadmap.md) for future plans.

## Acknowledgements

This plugin is inspired by and built with reference to several excellent projects and resources:

- [Obsidian plugin documentation](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin): plugin structure, settings, and build workflow.
- [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin): plugin scaffold, version bumping, and release flow.
- [Bangumi API](https://github.com/bangumi/api): the foundation for Bangumi data access.
- [obsidian-weread-plugin](https://github.com/zhaohongxuan/obsidian-weread-plugin): design reference for collection and reading sync plugins.
- [yearly-glance](https://github.com/Moyf/yearly-glance): reference for README structure and release-facing documentation.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
