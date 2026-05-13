import { App } from "obsidian";

import { BangumiClient } from "../bangumi/client";
import { BangumiSyncSettings } from "../settings";
import { MarkdownRenderer } from "./markdown-renderer";
import { NoteWriter } from "./note-writer";

export interface SyncResult {
	synced: number;
	message: string;
}

export class SyncService {
	constructor(
		private readonly app: App,
		private readonly settings: BangumiSyncSettings
	) {}

	async sync(): Promise<SyncResult> {
		if (!this.settings.accessToken) {
			return {
				synced: 0,
				message: "Add a Bangumi access token in plugin settings first."
			};
		}

		if (this.settings.collectionTypes.length === 0) {
			return {
				synced: 0,
				message: "Select at least one Bangumi collection status to sync."
			};
		}

		const client = new BangumiClient({
			accessToken: this.settings.accessToken,
			userAgent: this.settings.userAgent
		});
		const username = this.settings.username || (await client.getMe()).username;

		// Skeleton behavior: validate configuration and fetch the first page only.
		// Full pagination and note writes are intentionally left for the next pass.
		const firstPage = await client.getCollections({
			username,
			subjectType: 2,
			collectionType: this.settings.collectionTypes[0],
			limit: 1,
			offset: 0
		});

		const writer = new NoteWriter(this.app, new MarkdownRenderer());
		void writer;

		return {
			synced: 0,
			message: `Connected as ${username}. Found ${firstPage.total} matching Bangumi items. Note writing is scaffolded for the next implementation pass.`
		};
	}
}
