import { App, PluginSettingTab, Setting } from "obsidian";

import type BangumiSyncPlugin from "./main";
import {
	BANGUMI_COLLECTION_TYPES,
	BangumiCollectionType
} from "./bangumi/types";

export interface BangumiSyncSettings {
	accessToken: string;
	username: string;
	syncDirectory: string;
	collectionTypes: BangumiCollectionType[];
	userAgent: string;
}

export const DEFAULT_SETTINGS: BangumiSyncSettings = {
	accessToken: "",
	username: "",
	syncDirectory: "Bangumi/Anime",
	collectionTypes: [BANGUMI_COLLECTION_TYPES.do],
	userAgent: "zhaoyuanhua/bangumi-sync/0.1.0 (Obsidian Plugin)"
};

const COLLECTION_OPTIONS: Array<{
	key: BangumiCollectionType;
	label: string;
	description: string;
}> = [
	{
		key: BANGUMI_COLLECTION_TYPES.wish,
		label: "Wish",
		description: "Sync subjects marked as want to watch."
	},
	{
		key: BANGUMI_COLLECTION_TYPES.collect,
		label: "Collected",
		description: "Sync subjects marked as watched."
	},
	{
		key: BANGUMI_COLLECTION_TYPES.do,
		label: "Watching",
		description: "Sync subjects currently in progress."
	},
	{
		key: BANGUMI_COLLECTION_TYPES.onHold,
		label: "On hold",
		description: "Sync subjects marked as on hold."
	},
	{
		key: BANGUMI_COLLECTION_TYPES.dropped,
		label: "Dropped",
		description: "Sync subjects marked as dropped."
	}
];

export class BangumiSyncSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: BangumiSyncPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Bangumi Sync" });

		new Setting(containerEl)
			.setName("Access token")
			.setDesc("Paste a Bangumi access token. OAuth setup will be added later.")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("Bearer token")
					.setValue(this.plugin.settings.accessToken)
					.onChange(async (value) => {
						this.plugin.settings.accessToken = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Username")
			.setDesc("Optional. If empty, the plugin will use /v0/me when syncing.")
			.addText((text) =>
				text
					.setPlaceholder("Bangumi username")
					.setValue(this.plugin.settings.username)
					.onChange(async (value) => {
						this.plugin.settings.username = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Sync directory")
			.setDesc("Notes will be created under this folder.")
			.addText((text) =>
				text
					.setPlaceholder("Bangumi/Anime")
					.setValue(this.plugin.settings.syncDirectory)
					.onChange(async (value) => {
						this.plugin.settings.syncDirectory = value.trim() || "Bangumi/Anime";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("User-Agent")
			.setDesc("Bangumi requires API clients to identify themselves.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.userAgent)
					.setValue(this.plugin.settings.userAgent)
					.onChange(async (value) => {
						this.plugin.settings.userAgent =
							value.trim() || DEFAULT_SETTINGS.userAgent;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "Collection statuses" });

		for (const option of COLLECTION_OPTIONS) {
			new Setting(containerEl)
				.setName(option.label)
				.setDesc(option.description)
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
	}
}
