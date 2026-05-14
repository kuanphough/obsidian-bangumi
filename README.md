# Bangumi Sync

English | [中文文档](README-zh.md)

Obsidian plugin for syncing Bangumi anime collections and episode progress into Markdown notes.

## Usage

1. Install or build the plugin in an Obsidian vault plugin directory.
2. Enable the plugin in Obsidian.
3. Open the plugin settings, click `Open token page`, log in to Bangumi, create a token, and copy it.
4. Click `Fill from clipboard` in the plugin settings, or paste the token into `Access token` manually.
5. The plugin automatically syncs the Bangumi account that owns the saved token.
6. Choose the storage layout, file name format, subject types, and collection statuses to sync, then click the ribbon icon or run `Bangumi Sync: Sync now`.

The plugin follows the Obsidian app language. Simplified Chinese and Traditional Chinese display Chinese UI text; other languages display English.

The Bangumi `User-Agent` is generated automatically as `Kuanphough/bangumi-sync/<plugin-version> (Obsidian Plugin)`, so users do not need to configure it manually.

### Access Token

To get a token:

1. Click `Open token page` in the plugin settings, or open <https://next.bgm.tv/demo/access-token/create>.
2. Log in to Bangumi if the page asks you to.
3. Create a new access token.
4. Copy the generated token.
5. Click `Fill from clipboard`, or paste it into the plugin setting `Access token`.

Keep the token private. It authorizes the plugin to read your Bangumi account data. The token input is displayed as a password field in settings.

Notes are created under `Bangumi` by default. Each file name includes the Bangumi subject ID, for example `Title [bgm-123].md`, so subjects with the same title do not overwrite each other.

## File Names

The `File name format` setting supports:

- `Title [bgm-id]`: example `Title [bgm-123].md`.
- `[bgm-id] Title`: example `[bgm-123] Title.md`.
- `Bangumi ID only`: example `bgm-123.md`.

## Storage Layouts

The `Storage layout` setting controls where synced note files are created:

- `No categories`: all synced notes are stored directly in the sync directory.
- `By subject type`: notes are stored as `Sync directory / subject type / collection status`.
- `By collection status`: notes are stored as `Sync directory / collection status / subject type`.

The subject type folders use `book`, `anime`, `music`, `game`, and `real`. The collection status folders use `wish`, `collect`, `do`, `on_hold`, and `dropped`.

## Sync Behavior

- Syncs the selected subject types: books (`1`), anime (`2`), music (`3`), games (`4`), and real-life media (`6`).
- Fetches all selected collection statuses with pagination.
- Skips on-hold and dropped statuses unless `Include on hold/dropped` is enabled.
- When incremental sync is enabled, skips unchanged collections based on Bangumi `updated_at` and the last successful sync time. Episode-progress fetch issues do not block advancing the sync timestamp after notes are written.
- Fetches episode progress for each subject when available.
- Writes Bangumi metadata, user rating, user tags, user comment, cover, Base-friendly progress fields, and episode checklist.
- Shows only start, subject-type/status summary, and final notices during sync, and writes `Bangumi Sync Report.md` when issues occur.
- Updates frontmatter and the `<!-- bangumi-sync-start -->` to `<!-- bangumi-sync-end -->` block on repeat syncs.
- Leaves content outside the sync block, including `## Notes`, for permanent notes.
- Continues syncing other subjects if one subject fails, then reports the issue count.

## Note Template

The `Subject note template` setting lets you customize the Markdown generated for each synced subject.

The template must include `{{sync_block_start}}` and `{{sync_block_end}}`. If either marker is missing, the plugin falls back to the built-in default template to avoid overwriting handwritten notes.

The default frontmatter includes progress fields for Obsidian Base and Dataview: `progress_done`, `progress_total`, `progress_percent`, `progress_available`, `next_episode`, `next_episode_sort`, `last_done_episode`, and `last_done_episode_sort`.

Bangumi's current v0 episode collection endpoint does not return the user's per-episode comment text, so per-episode comments are not synced.

Common variables:

- `{{title}}`, `{{title_json}}`
- `{{original_title}}`, `{{original_title_json}}`
- `{{type}}`, `{{status}}`, `{{rating}}`, `{{eps_total}}`
- `{{progress_done}}`, `{{progress_total}}`, `{{progress_percent}}`, `{{progress_available}}`
- `{{next_episode_json}}`, `{{next_episode_sort}}`
- `{{last_done_episode_json}}`, `{{last_done_episode_sort}}`
- `{{air_date_yaml}}`, `{{updated_at_yaml}}`
- `{{bangumi_tags_json}}`, `{{comment_json}}`
- `{{cover}}`, `{{cover_yaml}}`, `{{cover_image}}`
- `{{tags_yaml}}`, `{{progress}}`
- `{{sync_block_start}}`, `{{sync_block_end}}`

## Development

```bash
npm install
npm run build
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

## Current Limits

- OAuth login is not exposed because it requires users to create their own Bangumi OAuth application.
- Daily Notes sync is not implemented.

## Roadmap

### Stabilize the MVP

- [x] Test the full sync flow in a real Obsidian vault with a real Bangumi token.
- [x] Improve error messages for expired tokens, missing permissions, and Bangumi API rate limits.
- [ ] Add lightweight tests for Markdown rendering, sync-block merging, and duplicate file prevention.
- [ ] Add a manual `Test token` action in settings before running a full sync.

### Better Sync Experience

- [x] Show clearer sync progress and final details, including which subjects failed.
- [x] Support configurable subject types beyond anime, such as books, music, games, and real-life media.
- [x] Add options for file naming and whether to include dropped/on-hold items.
- [x] Support incremental sync using the last synced timestamp where the Bangumi API allows it.

### Notes and Templates

- [x] Add a user-editable Markdown template for synced subject notes.
- [ ] Support custom frontmatter fields for Dataview workflows.
- [ ] Add safer merge behavior for users who want to edit parts of the generated Bangumi section.
- [ ] Optionally create index notes by status, year, tag, or subject type.

### Account and Distribution

- [x] Add token-page and clipboard helpers so users can get and fill an access token with fewer steps.
- [ ] Revisit OAuth login only if there is a practical public-client flow that does not require users to manage their own client secret.
- [ ] Add release packaging instructions for `manifest.json`, `main.js`, and optional `styles.css`.
- [ ] Add version bump and release checklist for publishing as an Obsidian community plugin.
- [ ] Review mobile compatibility and document any desktop-only limitations.
