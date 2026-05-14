import { Notice, Plugin, TFile, normalizePath } from "obsidian";

import {
	BangumiSyncSettingTab,
	BangumiSyncSettings,
	buildUserAgent,
	DEFAULT_SETTINGS
} from "./settings";
import { t } from "./i18n";
import { BangumiClient } from "./bangumi/client";
import {
	DEFAULT_SUBJECT_NOTE_TEMPLATE,
	LEGACY_DEFAULT_SUBJECT_NOTE_TEMPLATE
} from "./sync/markdown-renderer";
import { SyncService } from "./sync/sync-service";

const ACCESS_TOKEN_CREATE_URL = "https://next.bgm.tv/demo/access-token/create";
const TEMPLATE_VARIABLES_FILE_NAME = "Template Variables.md";
const TEMPLATE_VARIABLES_CONTENT = `# Bangumi Sync Template Variables

The \`Subject note template\` setting supports \`{{variable_name}}\` placeholders.

The template must include both \`{{sync_block_start}}\` and \`{{sync_block_end}}\`. On repeat syncs, the plugin updates the frontmatter and the content between those markers while keeping the rest of the note.

## Identity

| Variable | Description |
| --- | --- |
| \`{{bangumi_id}}\` | Bangumi subject ID. |
| \`{{title}}\` | Display title, preferring Chinese title when available. |
| \`{{title_json}}\` | JSON/YAML-safe title string. |
| \`{{original_title}}\` | Original Bangumi title. |
| \`{{original_title_json}}\` | JSON/YAML-safe original title string. |
| \`{{type}}\` | Subject type label: \`book\`, \`anime\`, \`music\`, \`game\`, or \`real\`. |
| \`{{status}}\` | Collection status label: \`wish\`, \`collect\`, \`do\`, \`on_hold\`, or \`dropped\`. |

## Collection Metadata

| Variable | Description |
| --- | --- |
| \`{{rating}}\` | User rating. Empty when unrated. |
| \`{{eps_total}}\` | Total episode count from Bangumi, when available. |
| \`{{air_date}}\` | Subject air/release date. |
| \`{{air_date_yaml}}\` | YAML-safe air/release date. |
| \`{{updated_at}}\` | Collection update time. |
| \`{{updated_at_yaml}}\` | YAML-safe collection update time. |
| \`{{bangumi_tags_json}}\` | User collection tags as a JSON array. |
| \`{{comment}}\` | User collection comment. |
| \`{{comment_json}}\` | JSON/YAML-safe user collection comment. |

## Progress

| Variable | Description |
| --- | --- |
| \`{{progress_done}}\` | Completed episode count, based on episode collection \`type > 0\`. |
| \`{{progress_total}}\` | Total episode count, preferring subject \`eps\`, then fetched episode count. |
| \`{{progress_percent}}\` | Integer percentage, rounded from \`done / total * 100\`. |
| \`{{progress_available}}\` | \`true\` when episode progress was fetched and has valid episodes, otherwise \`false\`. |
| \`{{next_episode_json}}\` | JSON/YAML-safe next unfinished episode label, or empty string. |
| \`{{next_episode_sort}}\` | Next unfinished episode sort number, or empty string. |
| \`{{last_done_episode_json}}\` | JSON/YAML-safe last completed episode label, or empty string. |
| \`{{last_done_episode_sort}}\` | Last completed episode sort number, or empty string. |
| \`{{progress}}\` | Rendered Markdown episode checklist for the sync block. |

## Media And Tags

| Variable | Description |
| --- | --- |
| \`{{cover}}\` | Cover image URL. |
| \`{{cover_yaml}}\` | YAML-safe cover image URL. |
| \`{{cover_image}}\` | Markdown image syntax for the cover. |
| \`{{tags_yaml}}\` | YAML list containing \`bangumi\`, subject type, and collection status. |

## Sync Markers

| Variable | Description |
| --- | --- |
| \`{{sync_block_start}}\` | Required sync block start marker. |
| \`{{sync_block_end}}\` | Required sync block end marker. |

## Default Frontmatter Example

\`\`\`markdown
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
\`\`\`
`;

export default class BangumiSyncPlugin extends Plugin {
	settings: BangumiSyncSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon("refresh-cw", t("syncRibbon"), () => {
			void this.syncNow();
		});

		this.addCommand({
			id: "sync-now",
			name: t("syncNow"),
			callback: () => {
				void this.syncNow();
			}
		});

		this.addSettingTab(new BangumiSyncSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		const loadedData: unknown = await this.loadData();
		const loadedSettings: Partial<BangumiSyncSettings> =
			this.isSettingsRecord(loadedData) ? loadedData : {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedSettings);
		this.settings.username = "";
		this.settings.userAgent = buildUserAgent(this.manifest.version);
		let migrated = false;
		if (
			this.settings.subjectNoteTemplate ===
			LEGACY_DEFAULT_SUBJECT_NOTE_TEMPLATE
		) {
			this.settings.subjectNoteTemplate = DEFAULT_SUBJECT_NOTE_TEMPLATE;
			migrated = true;
		}
		if (migrated) {
			await this.saveSettings();
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private isSettingsRecord(value: unknown): value is Partial<BangumiSyncSettings> {
		return typeof value === "object" && value !== null;
	}

	async openTemplateVariablesDoc(): Promise<void> {
		try {
			const directory = normalizePath(this.settings.syncDirectory || "Bangumi");
			await this.ensureFolder(directory);
			const path = normalizePath(`${directory}/${TEMPLATE_VARIABLES_FILE_NAME}`);
			const existing = this.app.vault.getAbstractFileByPath(path);
			const file =
				existing instanceof TFile
					? existing
					: await this.app.vault.create(path, TEMPLATE_VARIABLES_CONTENT);
			await this.app.workspace.getLeaf(false).openFile(file);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : t("unknownError");
			new Notice(t("templateVariablesDocFailed", { message }));
			console.error(error);
		}
	}

	openAccessTokenPage(): void {
		window.open(ACCESS_TOKEN_CREATE_URL);
		new Notice(t("tokenPageOpened"));
	}

	async fillAccessTokenFromClipboard(): Promise<void> {
		try {
			const text = await navigator.clipboard.readText();
			const token = this.normalizeAccessToken(text);
			if (!token) {
				new Notice(t("clipboardTokenMissing"));
				return;
			}
			this.settings.accessToken = token;
			await this.saveSettings();
			new Notice(t("clipboardTokenFilled"));
		} catch (error) {
			const message =
				error instanceof Error ? error.message : t("unknownError");
			new Notice(t("clipboardTokenFailed", { message }));
			console.error(error);
		}
	}

	async testAccessToken(): Promise<void> {
		if (!this.settings.accessToken) {
			new Notice(t("noToken"));
			return;
		}

		try {
			const user = await new BangumiClient({
				accessToken: this.settings.accessToken,
				userAgent: this.settings.userAgent
			}).getMe();
			new Notice(t("testTokenSucceeded", { username: user.username }));
		} catch (error) {
			const message =
				error instanceof Error ? error.message : t("unknownError");
			new Notice(t("testTokenFailed", { message }));
			console.error(error);
		}
	}

	private normalizeAccessToken(value: string): string {
		return value.trim().replace(/^Bearer\s+/i, "").trim();
	}

	private async ensureFolder(path: string): Promise<void> {
		const parts = normalizePath(path).split("/");
		let current = "";

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}

	private async syncNow(): Promise<void> {
		try {
			const result = await new SyncService(this.app, this.settings).sync({
				onProgress: (progress) => {
					if (
						progress.stage === "start" ||
						progress.stage === "summary" ||
						progress.stage === "warning"
					) {
						new Notice(progress.message);
					}
				}
			});
			await this.saveSettings();
			new Notice(result.message);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : t("unknownError");
			new Notice(t("syncFailed", { message }));
			console.error(error);
		}
	}
}
