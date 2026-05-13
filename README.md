# Bangumi Sync

Obsidian plugin skeleton for syncing Bangumi anime collections and episode progress into Markdown notes.

## Development

```bash
npm install
npm run build
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

## Current MVP

- Loads as an Obsidian community plugin with ID `bangumi-sync`.
- Adds a ribbon action and command palette command for `Sync now`.
- Provides settings for Bangumi access token, username, sync directory, User-Agent, and collection statuses.
- Scaffolds Bangumi API client, sync service, Markdown renderer, and note writer.
- Validates token/config and fetches a first collection page, but does not write real notes yet.
