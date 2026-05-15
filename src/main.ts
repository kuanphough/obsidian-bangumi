import {
	App,
	Notice,
	Plugin,
	SuggestModal,
	TFile,
	normalizePath
} from "obsidian";

import {
	BangumiSyncSettingTab,
	BangumiSyncSettings,
	buildUserAgent,
	DEFAULT_SETTINGS
} from "./settings";
import { t } from "./i18n";
import { BangumiApiError, BangumiClient } from "./bangumi/client";
import {
	BANGUMI_COLLECTION_TYPES,
	BANGUMI_SUBJECT_TYPES,
	BangumiCollection,
	BangumiCollectionType,
	BangumiSubject
} from "./bangumi/types";
import {
	DEFAULT_SUBJECT_NOTE_TEMPLATE,
	LEGACY_DEFAULT_SUBJECT_NOTE_TEMPLATE
} from "./sync/markdown-renderer";
import { SyncService } from "./sync/sync-service";

const ACCESS_TOKEN_CREATE_URL = "https://next.bgm.tv/demo/access-token/create";
const TEMPLATE_VARIABLES_FILE_NAME = "Template Variables.md";
const SEARCH_SUBJECT_TYPES = [
	BANGUMI_SUBJECT_TYPES.book,
	BANGUMI_SUBJECT_TYPES.anime,
	BANGUMI_SUBJECT_TYPES.music,
	BANGUMI_SUBJECT_TYPES.game,
	BANGUMI_SUBJECT_TYPES.real
];
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

		this.addCommand({
			id: "sync-one-subject",
			name: t("syncOneSubject"),
			callback: () => {
				this.openSyncOneSubjectModal();
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

	openSyncOneSubjectModal(): void {
		if (!this.settings.accessToken) {
			new Notice(t("noToken"));
			return;
		}
		const client = new BangumiClient({
			accessToken: this.settings.accessToken,
			userAgent: this.settings.userAgent
		});
		new SubjectLookupModal(
			this.app,
			client,
			(input) => this.parseSubjectId(input),
			(suggestion) => {
				if (suggestion.kind === "direct") {
					void this.syncOneSubjectById(client, suggestion.subjectId);
					return;
				}
				void this.syncOneSubjectById(client, suggestion.subject.id, suggestion.subject);
			}
		).open();
	}

	private async syncOneSubjectById(
		client: BangumiClient,
		subjectId: number,
		searchSubject?: BangumiSubject
	): Promise<void> {
		try {
			let collection: BangumiCollection;
			try {
				collection = await this.fetchSubjectCollection(
					client,
					subjectId,
					searchSubject?.type
				);
			} catch (error) {
				if (!this.isBangumiNotFound(error)) {
					throw error;
				}

				const subject = await this.fetchSubjectForLocalCollection(
					client,
					subjectId,
					searchSubject
				);
				const collectionType = await this.chooseLocalCollectionType(subject);
				if (collectionType === null) {
					new Notice(t("syncOneSubjectCancelled"));
					return;
				}
				collection = this.createLocalCollection(subject, collectionType);
			}

			new Notice(
				t("syncOneSubjectStarted", {
					title: this.getSubjectTitle(collection.subject)
				})
			);

			const result = await new SyncService(
				this.app,
				this.settings
			).syncSubjectCollection(collection);
			const title = this.getSubjectTitle(collection.subject);
			new Notice(
				t(result.changed ? "syncOneSubjectUpdated" : "syncOneSubjectUnchanged", {
					title,
					path: result.path
				})
			);
			if (result.episodeSyncError) {
				new Notice(t("syncOneSubjectProgressMissing"));
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : t("unknownError");
			new Notice(t("syncOneSubjectFailed", { message }));
			console.error(error);
		}
	}

	private async fetchSubjectCollection(
		client: BangumiClient,
		subjectId: number,
		preferredSubjectType?: number
	): Promise<BangumiCollection> {
		const username = this.settings.username || (await client.getMe()).username || "-";
		const attempts: Array<Promise<BangumiCollection | null>> = [
			this.getSubjectCollectionOrNull(client, subjectId, username)
		];

		if (username !== "-") {
			attempts.push(this.getSubjectCollectionOrNull(client, subjectId));
		}

		attempts.push(
			this.findSubjectCollectionInLists(
				client,
				username,
				subjectId,
				preferredSubjectType
			)
		);

		const results = await Promise.all(attempts);
		const collection = results.find(
			(result): result is BangumiCollection => result !== null
		);
		if (collection) {
			return collection;
		}

		throw new BangumiApiError(
			t("apiNotFound", {
				status: 404,
				path: `/v0/users/${username}/collections/${subjectId}`,
				detail: ""
			}),
			404,
			`/v0/users/${username}/collections/${subjectId}`
		);
	}

	private async getSubjectCollectionOrNull(
		client: BangumiClient,
		subjectId: number,
		username?: string
	): Promise<BangumiCollection | null> {
		try {
			return await client.getSubjectCollection(subjectId, username);
		} catch (error) {
			if (!this.isBangumiNotFound(error)) {
				throw error;
			}
			return null;
		}
	}

	private async findSubjectCollectionInLists(
		client: BangumiClient,
		username: string,
		subjectId: number,
		preferredSubjectType?: number
	): Promise<BangumiCollection | null> {
		const subjectTypes = preferredSubjectType
			? [preferredSubjectType]
			: SEARCH_SUBJECT_TYPES;

		for (const subjectType of subjectTypes) {
			for (const collectionType of Object.values(
				BANGUMI_COLLECTION_TYPES
			) as BangumiCollectionType[]) {
				const page = await client.getCollections({
					username,
					subjectType,
					collectionType,
					limit: 50,
					offset: 0
				});
				const match = page.data.find(
					(collection) => collection.subject.id === subjectId
				);
				if (match) {
					return match;
				}
			}
		}

		return null;
	}

	private parseSubjectId(input: string): number | null {
		const match = input.match(/(?:subject\/|^)(\d+)(?:[/?#].*)?$/);
		if (!match) {
			return null;
		}

		const subjectId = Number(match[1]);
		return Number.isInteger(subjectId) && subjectId > 0 ? subjectId : null;
	}

	private async fetchSubjectForLocalCollection(
		client: BangumiClient,
		subjectId: number,
		searchSubject?: BangumiSubject
	): Promise<BangumiSubject> {
		try {
			return await client.getSubject(subjectId);
		} catch (error) {
			if (!this.isBangumiNotFound(error)) {
				throw error;
			}
			console.error(
				`Bangumi Sync failed to fetch v0 subject ${subjectId}, trying legacy subject API`,
				error
			);
		}

		try {
			return await client.getLegacySubject(subjectId);
		} catch (error) {
			if (searchSubject) {
				console.error(
					`Bangumi Sync failed to fetch legacy subject ${subjectId}, falling back to search result`,
					error
				);
				return searchSubject;
			}
			throw error;
		}
	}

	private isBangumiNotFound(error: unknown): boolean {
		return (
			typeof error === "object" &&
			error !== null &&
			"status" in error &&
			(error as { status?: unknown }).status === 404
		);
	}

	private chooseLocalCollectionType(
		subject: BangumiSubject
	): Promise<BangumiCollectionType | null> {
		return new Promise((resolve) => {
			new CollectionStatusModal(this.app, subject, resolve).open();
		});
	}

	private createLocalCollection(
		subject: BangumiSubject,
		type: BangumiCollectionType
	): BangumiCollection {
		return {
			type,
			rate: 0,
			comment: "",
			tags: [],
			updated_at: "",
			subject
		};
	}

	private getSubjectTitle(subject: BangumiSubject): string {
		return subject.name_cn || subject.name;
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

type SubjectLookupSuggestion =
	| {
			kind: "direct";
			subjectId: number;
			query: string;
	  }
	| {
			kind: "subject";
			subject: BangumiSubject;
	  };

class SubjectLookupModal extends SuggestModal<SubjectLookupSuggestion> {
	constructor(
		app: App,
		private readonly client: BangumiClient,
		private readonly parseSubjectId: (input: string) => number | null,
		private readonly onChoose: (suggestion: SubjectLookupSuggestion) => void
	) {
		super(app);
		this.setPlaceholder(t("syncOneSubjectInputPlaceholder"));
	}

	async getSuggestions(query: string): Promise<SubjectLookupSuggestion[]> {
		const normalizedQuery = query.trim();
		if (!normalizedQuery) {
			return [];
		}

		const subjectId = this.parseSubjectId(normalizedQuery);
		if (subjectId !== null) {
			return [{ kind: "direct", subjectId, query: normalizedQuery }];
		}

		try {
			const page = await this.client.searchSubjects({
				keyword: normalizedQuery,
				sort: "match",
				filter: { type: SEARCH_SUBJECT_TYPES },
				limit: 20,
				offset: 0
			});
			return page.data.map((subject) => ({ kind: "subject", subject }));
		} catch (error) {
			const message =
				error instanceof Error ? error.message : t("unknownError");
			new Notice(t("syncOneSubjectFailed", { message }));
			console.error(error);
			return [];
		}
	}

	renderSuggestion(suggestion: SubjectLookupSuggestion, el: HTMLElement): void {
		if (suggestion.kind === "direct") {
			el.createDiv({
				text: t("syncOneSubjectDirectOption", {
					id: suggestion.subjectId
				})
			});
			el.createEl("small", { text: suggestion.query });
			return;
		}

		const subject = suggestion.subject;
		const title = subject.name_cn || subject.name;
		const original = subject.name_cn && subject.name_cn !== subject.name
			? ` / ${subject.name}`
			: "";
		const metadata = [
			subject.date,
			subject.rating?.score ? `score ${subject.rating.score}` : "",
			`bgm-${subject.id}`,
			`🏷 ${renderSubjectType(subject.type)}`
		].filter((value) => value);

		el.createDiv({ text: `${title}${original}` });
		el.createEl("small", { text: metadata.join(" · ") });
	}

	onChooseSuggestion(suggestion: SubjectLookupSuggestion): void {
		this.onChoose(suggestion);
	}
}

class CollectionStatusModal extends SuggestModal<{
	type: BangumiCollectionType;
	label: string;
}> {
	private selected = false;

	constructor(
		app: App,
		private readonly subject: BangumiSubject,
		private readonly resolve: (type: BangumiCollectionType | null) => void
	) {
		super(app);
		this.setPlaceholder(t("syncOneSubjectStatusPlaceholder"));
	}

	getSuggestions(query: string): Array<{
		type: BangumiCollectionType;
		label: string;
	}> {
		const options = [
			{ type: BANGUMI_COLLECTION_TYPES.wish, label: "wish" },
			{ type: BANGUMI_COLLECTION_TYPES.do, label: "do" },
			{ type: BANGUMI_COLLECTION_TYPES.collect, label: "collect" },
			{ type: BANGUMI_COLLECTION_TYPES.onHold, label: "on_hold" },
			{ type: BANGUMI_COLLECTION_TYPES.dropped, label: "dropped" }
		];
		const normalizedQuery = query.trim().toLowerCase();
		return normalizedQuery
			? options.filter((option) => option.label.includes(normalizedQuery))
			: options;
	}

	renderSuggestion(
		option: {
			type: BangumiCollectionType;
			label: string;
		},
		el: HTMLElement
	): void {
		el.createDiv({
			text: t("syncOneSubjectStatusOption", {
				status: option.label,
				title: this.subject.name_cn || this.subject.name
			})
		});
	}

	onChooseSuggestion(option: {
		type: BangumiCollectionType;
		label: string;
	}): void {
		this.selected = true;
		this.resolve(option.type);
	}

	onClose(): void {
		if (!this.selected) {
			this.resolve(null);
		}
	}
}

function renderSubjectType(type: number): string {
	switch (type) {
		case BANGUMI_SUBJECT_TYPES.book:
			return "book";
		case BANGUMI_SUBJECT_TYPES.anime:
			return "anime";
		case BANGUMI_SUBJECT_TYPES.music:
			return "music";
		case BANGUMI_SUBJECT_TYPES.game:
			return "game";
		case BANGUMI_SUBJECT_TYPES.real:
			return "real";
		default:
			return String(type);
	}
}
