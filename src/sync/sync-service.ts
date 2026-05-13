import { App } from "obsidian";

import {
	BangumiCollection,
	BangumiCollectionType,
	BangumiEpisodeCollection
} from "../bangumi/types";
import { BangumiClient } from "../bangumi/client";
import { BangumiSyncSettings } from "../settings";
import { MarkdownRenderer } from "./markdown-renderer";
import { NoteWriter } from "./note-writer";

export interface SyncResult {
	synced: number;
	skipped: number;
	failed: number;
	message: string;
}

const ANIME_SUBJECT_TYPE = 2;
const PAGE_LIMIT = 50;

export class SyncService {
	constructor(
		private readonly app: App,
		private readonly settings: BangumiSyncSettings
	) {}

	async sync(): Promise<SyncResult> {
		if (!this.settings.accessToken) {
			return {
				synced: 0,
				skipped: 0,
				failed: 0,
				message: "Add a Bangumi access token in plugin settings first."
			};
		}

		if (this.settings.collectionTypes.length === 0) {
			return {
				synced: 0,
				skipped: 0,
				failed: 0,
				message: "Select at least one Bangumi collection status to sync."
			};
		}

		const client = new BangumiClient({
			accessToken: this.settings.accessToken,
			userAgent: this.settings.userAgent
		});
		const username = this.settings.username || (await client.getMe()).username;

		const writer = new NoteWriter(this.app, new MarkdownRenderer());
		const seenSubjectIds = new Set<number>();
		let synced = 0;
		let skipped = 0;
		let failed = 0;

		for (const collectionType of this.settings.collectionTypes) {
			let collections: BangumiCollection[];
			try {
				collections = await this.fetchAllCollections(
					client,
					username,
					collectionType
				);
			} catch (error) {
				failed += 1;
				console.error(
					`Bangumi Sync failed to fetch collection type ${collectionType}`,
					error
				);
				continue;
			}

			for (const collection of collections) {
				const subjectId = collection.subject.id;
				if (seenSubjectIds.has(subjectId)) {
					skipped += 1;
					continue;
				}
				seenSubjectIds.add(subjectId);

				let episodes: BangumiEpisodeCollection[] = [];
				let episodeSyncError: string | undefined;
				try {
					episodes = await this.fetchAllEpisodeCollections(client, subjectId);
				} catch (error) {
					failed += 1;
					episodeSyncError =
						error instanceof Error ? error.message : "Unknown episode sync error";
					console.error(
						`Bangumi Sync failed to fetch episodes for subject ${subjectId}`,
						error
					);
				}

				try {
					await writer.writeSubjectNote(this.settings.syncDirectory, {
						collection,
						episodes,
						episodeSyncError
					});
					synced += 1;
				} catch (error) {
					failed += 1;
					console.error(
						`Bangumi Sync failed to write subject ${subjectId}`,
						error
					);
				}
			}
		}

		return {
			synced,
			skipped,
			failed,
			message: `Bangumi Sync finished for ${username}: ${synced} note(s) synced, ${skipped} skipped, ${failed} issue(s).`
		};
	}

	private async fetchAllCollections(
		client: BangumiClient,
		username: string,
		collectionType: BangumiCollectionType
	): Promise<BangumiCollection[]> {
		const collections: BangumiCollection[] = [];
		let offset = 0;
		let total = Number.POSITIVE_INFINITY;

		while (offset < total) {
			const page = await client.getCollections({
				username,
				subjectType: ANIME_SUBJECT_TYPE,
				collectionType,
				limit: PAGE_LIMIT,
				offset
			});

			total = page.total;
			collections.push(...page.data);

			if (page.data.length === 0) {
				break;
			}
			offset += page.data.length;
		}

		return collections;
	}

	private async fetchAllEpisodeCollections(
		client: BangumiClient,
		subjectId: number
	): Promise<BangumiEpisodeCollection[]> {
		const page = await client.getSubjectEpisodeCollections(subjectId);
		return page.data.sort(
			(left, right) => left.episode.sort - right.episode.sort
		);
	}
}
