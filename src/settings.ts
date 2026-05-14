import { App, Notice, PluginSettingTab, Setting } from "obsidian";

import type BangumiSyncPlugin from "./main";
import {
	BANGUMI_COLLECTION_TYPES,
	BANGUMI_SUBJECT_TYPES,
	BangumiCollectionType,
	BangumiSubjectType
} from "./bangumi/types";
import { formatLocalDateTime } from "./date-format";
import { t } from "./i18n";
import { DEFAULT_SUBJECT_NOTE_TEMPLATE } from "./sync/markdown-renderer";

export interface BangumiSyncSettings {
	accessToken: string;
	oauthClientId: string;
	oauthClientSecret: string;
	oauthRedirectUri: string;
	oauthAuthorizationCode: string;
	oauthState: string;
	username: string;
	syncDirectory: string;
	storageLayout: BangumiStorageLayout;
	fileNameFormat: BangumiFileNameFormat;
	includeOnHoldAndDropped: boolean;
	incrementalSync: boolean;
	dailyNoteSync: boolean;
	lastSyncedAt: string;
	subjectTypes: BangumiSubjectType[];
	collectionTypes: BangumiCollectionType[];
	subjectNoteTemplate: string;
	userAgent: string;
}

export const BANGUMI_STORAGE_LAYOUTS = {
	flat: "flat",
	subjectThenCollection: "subject-then-collection",
	collectionThenSubject: "collection-then-subject"
} as const;

export type BangumiStorageLayout =
	(typeof BANGUMI_STORAGE_LAYOUTS)[keyof typeof BANGUMI_STORAGE_LAYOUTS];

export const BANGUMI_FILE_NAME_FORMATS = {
	titleThenId: "title-then-id",
	idThenTitle: "id-then-title",
	idOnly: "id-only"
} as const;

export type BangumiFileNameFormat =
	(typeof BANGUMI_FILE_NAME_FORMATS)[keyof typeof BANGUMI_FILE_NAME_FORMATS];

export function buildUserAgent(version: string): string {
	return `Kuanphough/bangumi-note/${version} (Obsidian Plugin)`;
}

export const DEFAULT_SETTINGS: BangumiSyncSettings = {
	accessToken: "",
	oauthClientId: "",
	oauthClientSecret: "",
	oauthRedirectUri: "",
	oauthAuthorizationCode: "",
	oauthState: "",
	username: "",
	syncDirectory: "Bangumi",
	storageLayout: BANGUMI_STORAGE_LAYOUTS.flat,
	fileNameFormat: BANGUMI_FILE_NAME_FORMATS.titleThenId,
	includeOnHoldAndDropped: false,
	incrementalSync: true,
	dailyNoteSync: false,
	lastSyncedAt: "",
	subjectTypes: [BANGUMI_SUBJECT_TYPES.anime],
	collectionTypes: [BANGUMI_COLLECTION_TYPES.do],
	subjectNoteTemplate: DEFAULT_SUBJECT_NOTE_TEMPLATE,
	userAgent: buildUserAgent("0.1.2")
};

const SUBJECT_OPTIONS: Array<{
	key: BangumiSubjectType;
	labelKey: Parameters<typeof t>[0];
	descriptionKey: Parameters<typeof t>[0];
}> = [
	{
		key: BANGUMI_SUBJECT_TYPES.book,
		labelKey: "books",
		descriptionKey: "booksDesc"
	},
	{
		key: BANGUMI_SUBJECT_TYPES.anime,
		labelKey: "anime",
		descriptionKey: "animeDesc"
	},
	{
		key: BANGUMI_SUBJECT_TYPES.music,
		labelKey: "music",
		descriptionKey: "musicDesc"
	},
	{
		key: BANGUMI_SUBJECT_TYPES.game,
		labelKey: "game",
		descriptionKey: "gameDesc"
	},
	{
		key: BANGUMI_SUBJECT_TYPES.real,
		labelKey: "realLife",
		descriptionKey: "realLifeDesc"
	}
];

const COLLECTION_OPTIONS: Array<{
	key: BangumiCollectionType;
	labelKey: Parameters<typeof t>[0];
	descriptionKey: Parameters<typeof t>[0];
}> = [
	{
		key: BANGUMI_COLLECTION_TYPES.wish,
		labelKey: "wish",
		descriptionKey: "wishDesc"
	},
	{
		key: BANGUMI_COLLECTION_TYPES.collect,
		labelKey: "collected",
		descriptionKey: "collectedDesc"
	},
	{
		key: BANGUMI_COLLECTION_TYPES.do,
		labelKey: "watching",
		descriptionKey: "watchingDesc"
	},
	{
		key: BANGUMI_COLLECTION_TYPES.onHold,
		labelKey: "onHold",
		descriptionKey: "onHoldDesc"
	},
	{
		key: BANGUMI_COLLECTION_TYPES.dropped,
		labelKey: "dropped",
		descriptionKey: "droppedDesc"
	}
];

const STORAGE_LAYOUT_OPTIONS: Array<{
	key: BangumiStorageLayout;
	labelKey: Parameters<typeof t>[0];
	descriptionKey: Parameters<typeof t>[0];
}> = [
	{
		key: BANGUMI_STORAGE_LAYOUTS.flat,
		labelKey: "noCategories",
		descriptionKey: "noCategoriesDesc"
	},
	{
		key: BANGUMI_STORAGE_LAYOUTS.subjectThenCollection,
		labelKey: "bySubjectType",
		descriptionKey: "bySubjectTypeDesc"
	},
	{
		key: BANGUMI_STORAGE_LAYOUTS.collectionThenSubject,
		labelKey: "byCollectionStatus",
		descriptionKey: "byCollectionStatusDesc"
	}
];

const FILE_NAME_FORMAT_OPTIONS: Array<{
	key: BangumiFileNameFormat;
	labelKey: Parameters<typeof t>[0];
	descriptionKey: Parameters<typeof t>[0];
}> = [
	{
		key: BANGUMI_FILE_NAME_FORMATS.titleThenId,
		labelKey: "titleIdFormat",
		descriptionKey: "titleIdFormatDesc"
	},
	{
		key: BANGUMI_FILE_NAME_FORMATS.idThenTitle,
		labelKey: "idTitleFormat",
		descriptionKey: "idTitleFormatDesc"
	},
	{
		key: BANGUMI_FILE_NAME_FORMATS.idOnly,
		labelKey: "idOnlyFormat",
		descriptionKey: "idOnlyFormatDesc"
	}
];

const DAILY_NOTE_SYNC_SNIPPET = `<!-- bangumi-daily-sync-start -->
<!-- bangumi-daily-sync-end -->`;

export class BangumiSyncSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: BangumiSyncPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const selectedStorageLayout =
			STORAGE_LAYOUT_OPTIONS.find(
				(option) => option.key === this.plugin.settings.storageLayout
			) ?? STORAGE_LAYOUT_OPTIONS[0];
		const selectedFileNameFormat =
			FILE_NAME_FORMAT_OPTIONS.find(
				(option) => option.key === this.plugin.settings.fileNameFormat
			) ?? FILE_NAME_FORMAT_OPTIONS[0];

		containerEl.createEl("h2", { text: t("bangumiSync") });

		new Setting(containerEl)
			.setName(t("accessToken"))
			.setDesc(t("accessTokenDesc"))
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("Bearer token")
					.setValue(this.plugin.settings.accessToken)
					.onChange(async (value) => {
						this.plugin.settings.accessToken = value.trim();
						await this.plugin.saveSettings();
					});
			})
			.addButton((button) =>
				button
					.setButtonText(t("openTokenPage"))
					.onClick(() => {
						this.plugin.openAccessTokenPage();
					})
			)
			.addButton((button) =>
				button
					.setButtonText(t("fillFromClipboard"))
					.setCta()
					.onClick(() => {
						void this.plugin.fillAccessTokenFromClipboard().then(() => {
							this.display();
						});
					})
			)
			.addButton((button) =>
				button
					.setButtonText(t("testToken"))
					.onClick(() => {
						void this.plugin.testAccessToken();
					})
			);

		new Setting(containerEl)
			.setName(t("syncDirectory"))
			.setDesc(t("syncDirectoryDesc"))
			.addText((text) =>
				text
					.setPlaceholder("Bangumi")
					.setValue(this.plugin.settings.syncDirectory)
					.onChange(async (value) => {
						this.plugin.settings.syncDirectory = value.trim() || "Bangumi";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("storageLayout"))
			.setDesc(t(selectedStorageLayout.descriptionKey))
			.addDropdown((dropdown) => {
				for (const option of STORAGE_LAYOUT_OPTIONS) {
					dropdown.addOption(option.key, t(option.labelKey));
				}
				dropdown
					.setValue(this.plugin.settings.storageLayout)
					.onChange(async (value) => {
						this.plugin.settings.storageLayout =
							value as BangumiStorageLayout;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName(t("fileNameFormat"))
			.setDesc(t(selectedFileNameFormat.descriptionKey))
			.addDropdown((dropdown) => {
				for (const option of FILE_NAME_FORMAT_OPTIONS) {
					dropdown.addOption(option.key, t(option.labelKey));
				}
				dropdown
					.setValue(this.plugin.settings.fileNameFormat)
					.onChange(async (value) => {
						this.plugin.settings.fileNameFormat =
							value as BangumiFileNameFormat;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName(t("includeOnHoldDropped"))
			.setDesc(t("includeOnHoldDroppedDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeOnHoldAndDropped)
					.onChange(async (enabled) => {
						this.plugin.settings.includeOnHoldAndDropped = enabled;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("incrementalSync"))
			.setDesc(t("incrementalSyncDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.incrementalSync)
					.onChange(async (enabled) => {
						this.plugin.settings.incrementalSync = enabled;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName(t("dailyNoteSync"))
			.setDesc(t("dailyNoteSyncDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.dailyNoteSync)
					.onChange(async (enabled) => {
						this.plugin.settings.dailyNoteSync = enabled;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("dailyNoteSyncBlock"))
			.setDesc(t("dailyNoteSyncBlockDesc"))
			.addButton((button) =>
				button.setButtonText(t("copy")).onClick(async () => {
					await navigator.clipboard.writeText(DAILY_NOTE_SYNC_SNIPPET);
					new Notice(t("copiedDailyNoteSyncBlock"));
				})
			);
		const dailySnippetEl = containerEl.createEl("textarea", {
			text: DAILY_NOTE_SYNC_SNIPPET
		});
		dailySnippetEl.readOnly = true;
		dailySnippetEl.rows = 2;
		dailySnippetEl.style.width = "100%";
		dailySnippetEl.style.boxSizing = "border-box";
		dailySnippetEl.style.marginBottom = "12px";

		new Setting(containerEl)
			.setName(t("lastSyncedAt"))
			.setDesc(
				formatLocalDateTime(this.plugin.settings.lastSyncedAt) ||
					t("neverSynced")
			)
			.addButton((button) =>
				button.setButtonText(t("resetSyncState")).onClick(async () => {
					this.plugin.settings.lastSyncedAt = "";
					await this.plugin.saveSettings();
					this.display();
				})
			);

		containerEl.createEl("h3", { text: t("subjectTypes") });

		for (const option of SUBJECT_OPTIONS) {
			new Setting(containerEl)
				.setName(t(option.labelKey))
				.setDesc(t(option.descriptionKey))
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.subjectTypes.includes(option.key))
						.onChange(async (enabled) => {
							const selected = new Set(this.plugin.settings.subjectTypes);
							if (enabled) {
								selected.add(option.key);
							} else {
								selected.delete(option.key);
							}
							this.plugin.settings.subjectTypes = Array.from(selected);
							await this.plugin.saveSettings();
						})
				);
		}

		containerEl.createEl("h3", { text: t("collectionStatuses") });

		for (const option of COLLECTION_OPTIONS) {
			new Setting(containerEl)
				.setName(t(option.labelKey))
				.setDesc(t(option.descriptionKey))
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.collectionTypes.includes(option.key))
						.onChange(async (enabled) => {
							const selected = new Set(this.plugin.settings.collectionTypes);
							if (enabled) {
								selected.add(option.key);
							} else {
								selected.delete(option.key);
							}
							this.plugin.settings.collectionTypes = Array.from(selected);
							await this.plugin.saveSettings();
						})
				);
		}

		containerEl.createEl("h3", { text: t("noteTemplate") });

		const subjectTemplateSetting = new Setting(containerEl)
			.setName(t("subjectNoteTemplate"))
			.setDesc(t("subjectNoteTemplateDesc"));
		subjectTemplateSetting.descEl.style.maxWidth = "34em";
		subjectTemplateSetting.descEl.style.lineHeight = "1.45";

		const subjectTemplateEl = containerEl.createEl("textarea");
		subjectTemplateEl.rows = 18;
		subjectTemplateEl.value = this.plugin.settings.subjectNoteTemplate;
		subjectTemplateEl.style.width = "100%";
		subjectTemplateEl.style.minHeight = "360px";
		subjectTemplateEl.style.boxSizing = "border-box";
		subjectTemplateEl.style.marginTop = "8px";
		subjectTemplateEl.style.marginBottom = "8px";
		subjectTemplateEl.addEventListener("change", async () => {
			this.plugin.settings.subjectNoteTemplate =
				subjectTemplateEl.value.trim() || DEFAULT_SUBJECT_NOTE_TEMPLATE;
			await this.plugin.saveSettings();
		});

		new Setting(containerEl)
			.setName(t("templateVariablesDoc"))
			.setDesc(t("templateVariablesDocDesc"))
			.addButton((button) =>
				button
					.setButtonText(t("templateVariablesDoc"))
					.onClick(() => {
						void this.plugin.openTemplateVariablesDoc();
					})
			);

		new Setting(containerEl)
			.setName(t("resetSubjectNoteTemplate"))
			.setDesc(t("resetSubjectNoteTemplateDesc"))
			.addButton((button) =>
				button.setButtonText(t("reset")).onClick(async () => {
					this.plugin.settings.subjectNoteTemplate =
						DEFAULT_SUBJECT_NOTE_TEMPLATE;
					await this.plugin.saveSettings();
					this.display();
				})
			);
	}
}
