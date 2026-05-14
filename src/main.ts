import { Notice, Plugin } from "obsidian";

import {
	BangumiSyncSettingTab,
	BangumiSyncSettings,
	buildUserAgent,
	DEFAULT_SETTINGS
} from "./settings";
import { t } from "./i18n";
import { SyncService } from "./sync/sync-service";

const ACCESS_TOKEN_CREATE_URL = "https://next.bgm.tv/demo/access-token/create";

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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.settings.username = "";
		this.settings.userAgent = buildUserAgent(this.manifest.version);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
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

	private normalizeAccessToken(value: string): string {
		return value.trim().replace(/^Bearer\s+/i, "").trim();
	}

	private async syncNow(): Promise<void> {
		try {
			const result = await new SyncService(this.app, this.settings).sync({
				onProgress: (progress) => {
					if (progress.stage === "start" || progress.stage === "summary") {
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
