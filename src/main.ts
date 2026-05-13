import { Notice, Plugin } from "obsidian";

import {
	BangumiSyncSettingTab,
	BangumiSyncSettings,
	DEFAULT_SETTINGS
} from "./settings";
import { SyncService } from "./sync/sync-service";

export default class BangumiSyncPlugin extends Plugin {
	settings: BangumiSyncSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon("refresh-cw", "Sync Bangumi", () => {
			void this.syncNow();
		});

		this.addCommand({
			id: "sync-now",
			name: "Sync now",
			callback: () => {
				void this.syncNow();
			}
		});

		this.addSettingTab(new BangumiSyncSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async syncNow(): Promise<void> {
		try {
			const result = await new SyncService(this.app, this.settings).sync();
			new Notice(result.message);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown Bangumi sync error";
			new Notice(`Bangumi Sync failed: ${message}`);
			console.error(error);
		}
	}
}
