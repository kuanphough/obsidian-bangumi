# Bangumi Sync

English | [中文文档](README-zh.md)

Obsidian plugin for syncing Bangumi anime collections and episode progress into Markdown notes.

## Usage

1. Install or build the plugin in an Obsidian vault plugin directory.
2. Enable the plugin in Obsidian.
3. Create a Bangumi access token at <https://next.bgm.tv/demo/access-token/create>.
4. Open the plugin settings and paste the token into `Access token`.
   Paste only the token text itself. Do not add `Bearer`.
5. Optionally set a Bangumi username. If left empty, the plugin uses `/v0/me`.
6. Choose the collection statuses to sync and click the ribbon icon or run `Bangumi Sync: Sync now`.

### Access Token

To get a token:

1. Open <https://next.bgm.tv/demo/access-token/create>.
2. Log in to Bangumi if the page asks you to.
3. Create a new access token.
4. Copy the generated token.
5. Paste it into the plugin setting `Access token`.

Keep the token private. It authorizes the plugin to read your Bangumi account data.

Notes are created under `Bangumi/Anime` by default. Each file name includes the Bangumi subject ID, for example `Title [bgm-123].md`, so subjects with the same title do not overwrite each other.

## Sync Behavior

- Syncs anime subjects only (`subject_type=2`).
- Fetches all selected collection statuses with pagination.
- Fetches episode progress for each subject when available.
- Writes Bangumi metadata, user rating, user tags, user comment, cover, and episode checklist.
- Updates only the `<!-- bangumi-sync-start -->` to `<!-- bangumi-sync-end -->` block on repeat syncs.
- Leaves content outside the sync block, including `## Notes`, for permanent notes.
- Continues syncing other subjects if one subject fails, then reports the issue count.

## Development

```bash
npm install
npm run build
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

## Current Limits

- OAuth login is not implemented; paste an access token manually.
- Custom templates and Daily Notes sync are not implemented.
- The current MVP only syncs anime collections.

## Roadmap

### Stabilize the MVP

- Test the full sync flow in a real Obsidian vault with a real Bangumi token.
- Improve error messages for expired tokens, missing permissions, and Bangumi API rate limits.
- Add lightweight tests for Markdown rendering, sync-block merging, and duplicate file prevention.
- Add a manual `Test token` action in settings before running a full sync.

### Better Sync Experience

- Show clearer sync progress and final details, including which subjects failed.
- Support configurable subject types beyond anime, such as books, music, games, and real-life media.
- Add options for file naming, folder grouping, and whether to include dropped/on-hold items.
- Support incremental sync using the last synced timestamp where the Bangumi API allows it.

### Notes and Templates

- Add a user-editable Markdown template for synced subject notes.
- Support custom frontmatter fields for Dataview workflows.
- Add safer merge behavior for users who want to edit parts of the generated Bangumi section.
- Optionally create index notes by status, year, tag, or subject type.

### Account and Distribution

- Add OAuth login so users do not need to manually create and paste access tokens.
- Add release packaging instructions for `manifest.json`, `main.js`, and optional `styles.css`.
- Add version bump and release checklist for publishing as an Obsidian community plugin.
- Review mobile compatibility and document any desktop-only limitations.
