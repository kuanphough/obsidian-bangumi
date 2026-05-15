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
	DEFAULT_SUBJECT_NOTE_TEMPLATE_WITHOUT_SUMMARY,
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
const TEMPLATE_VARIABLES_CONTENT = `# Bangumi Sync Template Variables / 模板变量

\`Subject note template\` supports \`{{variable_name}}\` placeholders.  
\`条目笔记模板\` 支持 \`{{variable_name}}\` 占位符。

The template must include both \`{{sync_block_start}}\` and \`{{sync_block_end}}\`. On repeat syncs, the plugin updates frontmatter and the content between these markers, while keeping user-written content outside the sync block.  
模板必须包含 \`{{sync_block_start}}\` 和 \`{{sync_block_end}}\`。重复同步时，插件会更新 frontmatter 和这两个标记之间的同步块，并保留同步块之外的用户手写内容。

## Important Behavior / 重要行为

- Variables already used in your template are fetched automatically when possible. For example, using \`{{summary_section}}\` or \`{{subject_summary}}\` will trigger detailed subject info fetching.
- Settings under \`Template data toggles / 模板数据开关\` force extra data fetching even if the current template does not use those variables.
- Extra data such as staff, characters, and relations adds API requests and may slow sync.
- If an extra API request fails, note generation continues. Markdown variables become empty strings, JSON variables become empty arrays or objects, and the failure is recorded in the sync report.
- \`bangumi_tags\` means your personal collection tags. \`subject_tags\` means public Bangumi subject tags.
- Bangumi v0 episode collection APIs do not return user per-episode comments, so there is no single-episode comment variable.

- 模板里已经使用的变量会尽量自动拉取。例如使用 \`{{summary_section}}\` 或 \`{{subject_summary}}\` 会触发详细条目信息拉取。
- \`Template data toggles / 模板数据开关\` 会强制额外拉取数据，即使当前模板暂时没用到这些变量。
- Staff、Characters、Relations 等扩展数据会增加 API 请求，同步可能变慢。
- 扩展 API 请求失败不会阻止笔记生成。Markdown 变量会输出为空字符串，JSON 变量会输出空数组或空对象，并在同步报告里记录失败原因。
- \`bangumi_tags\` 是你的个人收藏标签；\`subject_tags\` 是 Bangumi 公共条目标签。
- Bangumi v0 章节收藏接口不返回用户单集评论，因此没有单集评论变量。

## Identity / 身份信息

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| \`{{bangumi_id}}\` | Bangumi subject ID. | Bangumi 条目 ID。 |
| \`{{title}}\` | Display title, preferring Chinese title when available. | 显示标题，优先中文名。 |
| \`{{title_json}}\` | JSON/YAML-safe display title. | 适合 JSON/YAML 的显示标题。 |
| \`{{original_title}}\` | Original Bangumi title. | 原名。 |
| \`{{original_title_json}}\` | JSON/YAML-safe original title. | 适合 JSON/YAML 的原名。 |
| \`{{type}}\` | Subject type: \`book\`, \`anime\`, \`music\`, \`game\`, or \`real\`. | 条目类型：\`book\`、\`anime\`、\`music\`、\`game\`、\`real\`。 |
| \`{{status}}\` | Collection status: \`wish\`, \`collect\`, \`do\`, \`on_hold\`, or \`dropped\`. | 收藏状态：\`wish\`、\`collect\`、\`do\`、\`on_hold\`、\`dropped\`。 |

## User Collection / 用户收藏信息

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| \`{{rating}}\` | Your rating. Empty when unrated. | 你的评分；未评分时为空。 |
| \`{{updated_at}}\` | Your collection update time. | 你的收藏更新时间。 |
| \`{{updated_at_yaml}}\` | YAML-safe collection update time. | 适合 YAML 的收藏更新时间。 |
| \`{{bangumi_tags_json}}\` | Your collection tags as JSON. | 你的收藏标签，JSON 数组。 |
| \`{{comment}}\` | Your collection comment. | 你的收藏短评。 |
| \`{{comment_json}}\` | JSON/YAML-safe collection comment. | 适合 JSON/YAML 的收藏短评。 |

## Subject Details / 条目详情

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| \`{{eps_total}}\` | Total episode count from Bangumi when available. | Bangumi 条目总集数/章节数。 |
| \`{{air_date}}\` | Subject air/release date. | 条目放送/发售日期。 |
| \`{{air_date_yaml}}\` | YAML-safe air/release date. | 适合 YAML 的日期。 |
| \`{{subject_summary}}\` | Subject summary text. Auto-fetches detailed subject info. | 条目简介。会自动拉取详细条目信息。 |
| \`{{summary_section}}\` | Rendered \`## Summary\` section. Empty when no summary exists. | 渲染好的 \`## Summary\` 段落；无简介时为空。 |
| \`{{subject_infobox}}\` | Rendered Markdown list from Bangumi infobox. | Bangumi infobox 渲染为 Markdown 列表。 |
| \`{{subject_infobox_json}}\` | Raw infobox as JSON. | 原始 infobox，JSON。 |
| \`{{subject_tags}}\` | Public subject tags with counts. | 公共条目标签及数量。 |
| \`{{subject_tags_json}}\` | Public subject tags as JSON. | 公共条目标签，JSON。 |
| \`{{subject_rating}}\` | Public score, total rating count, and rank. | 公共评分、评分人数和排名。 |
| \`{{subject_rating_json}}\` | Public rating data as JSON. | 公共评分数据，JSON。 |
| \`{{subject_collection_stats}}\` | Public wish/collect/doing/on-hold/dropped counts. | 全站收藏统计。 |
| \`{{subject_collection_stats_json}}\` | Public collection stats as JSON. | 全站收藏统计，JSON。 |

## Extended Lists / 扩展列表

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| \`{{staff}}\` | Rendered staff/person list. Auto-fetches staff. | 制作人员/人物列表。会自动拉取 Staff。 |
| \`{{staff_json}}\` | Staff/person list as JSON. | 制作人员/人物列表，JSON。 |
| \`{{characters}}\` | Rendered character list with actor names when available. Auto-fetches characters. | 角色列表，含可用的声优/演员。会自动拉取 Characters。 |
| \`{{characters_json}}\` | Character list as JSON. | 角色列表，JSON。 |
| \`{{relations}}\` | Rendered related subject list. Auto-fetches relations. | 关联条目列表。会自动拉取 Relations。 |
| \`{{relations_json}}\` | Related subject list as JSON. | 关联条目列表，JSON。 |

## Progress / 进度

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| \`{{progress_done}}\` | Completed episode count, based on episode collection \`type > 0\`. | 已完成章节数，按章节收藏 \`type > 0\` 统计。 |
| \`{{progress_total}}\` | Total count, preferring subject \`eps\`, then fetched episode count. | 总数，优先条目 \`eps\`，否则使用已拉取章节数。 |
| \`{{progress_percent}}\` | Integer percentage, rounded from \`done / total * 100\`. | 整数百分比，四舍五入。 |
| \`{{progress_available}}\` | \`true\` when episode progress was fetched and has valid episodes. | 成功拉到有效章节进度时为 \`true\`。 |
| \`{{next_episode_json}}\` | JSON/YAML-safe next unfinished episode label, or empty string. | 下一集/章节，适合 JSON/YAML；没有时为空字符串。 |
| \`{{next_episode_sort}}\` | Next unfinished episode sort number, or empty string. | 下一集/章节序号；没有时为空。 |
| \`{{last_done_episode_json}}\` | JSON/YAML-safe last completed episode label, or empty string. | 最后完成集/章节，适合 JSON/YAML；没有时为空。 |
| \`{{last_done_episode_sort}}\` | Last completed episode sort number, or empty string. | 最后完成集/章节序号；没有时为空。 |
| \`{{progress}}\` | Rendered Markdown episode checklist. | 渲染好的章节 checklist。 |

## Media And Tags / 媒体与标签

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| \`{{cover}}\` | Cover image URL. | 封面 URL。 |
| \`{{cover_yaml}}\` | YAML-safe cover image URL. | 适合 YAML 的封面 URL。 |
| \`{{cover_image}}\` | Markdown image syntax for the cover. | 封面 Markdown 图片语法。 |
| \`{{tags_yaml}}\` | YAML list containing \`bangumi\`, subject type, and collection status. | YAML 标签列表，包含 \`bangumi\`、条目类型和收藏状态。 |

## Sync Markers / 同步标记

| Variable / 变量 | English | 中文 |
| --- | --- | --- |
| \`{{sync_block_start}}\` | Required sync block start marker. | 必需的同步块开始标记。 |
| \`{{sync_block_end}}\` | Required sync block end marker. | 必需的同步块结束标记。 |

## Default Frontmatter Example / 默认 Frontmatter 示例

The built-in default keeps only basic lookup fields plus \`progress_done\`. More complete progress and extended subject data remain available for custom templates.  
内置默认模板只保留基础检索字段和 \`progress_done\`。更完整的进度字段和扩展条目数据仍可在自定义模板里手动使用。

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
		this.settings.fetchDetailedSubjectInfo =
			this.settings.fetchDetailedSubjectInfo === true;
		this.settings.fetchStaff = this.settings.fetchStaff === true;
		this.settings.fetchCharacters = this.settings.fetchCharacters === true;
		this.settings.fetchRelations = this.settings.fetchRelations === true;
		let migrated = false;
		if (
			this.settings.subjectNoteTemplate ===
				LEGACY_DEFAULT_SUBJECT_NOTE_TEMPLATE ||
			this.settings.subjectNoteTemplate ===
				DEFAULT_SUBJECT_NOTE_TEMPLATE_WITHOUT_SUMMARY
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
