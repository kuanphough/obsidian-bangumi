import { App, TFile } from "obsidian";

import { BangumiClient } from "../bangumi/client";
import { collectionStatusLabel } from "../bangumi/labels";
import {
	BANGUMI_COLLECTION_TYPES,
	BangumiCollectionType,
	BangumiEpisodeCollection
} from "../bangumi/types";
import type { BangumiSyncSettings } from "../settings";
import { t } from "../i18n";
import { SYNC_BLOCK_END, SYNC_BLOCK_START } from "./markdown-renderer";

export interface PushEpisodeChange {
	episodeId: number;
	sort: string;
	title: string;
	localChecked: boolean;
	remoteChecked: boolean;
}

export interface PushPreview {
	file: TFile;
	subjectId: number;
	localStatus: "do" | "collect";
	localCollectionType: BangumiCollectionType;
	remoteCollectionType: BangumiCollectionType;
	markDone: PushEpisodeChange[];
	markUndone: PushEpisodeChange[];
	unknownEpisodeIds: number[];
}

export interface PushResult {
	changedEpisodes: number;
	statusChanged: boolean;
	remoteStatusChanged: boolean;
	finalStatus: string;
	shouldResync: boolean;
}

interface ParsedChecklistItem {
	episodeId: number;
	sort: string;
	title: string;
	checked: boolean;
}

export class PushService {
	private readonly client: BangumiClient;

	constructor(
		private readonly app: App,
		private readonly settings: BangumiSyncSettings,
		clientFactory: () => BangumiClient = () =>
			new BangumiClient({
				accessToken: settings.accessToken,
				userAgent: settings.userAgent
			})
	) {
		this.client = clientFactory();
	}

	async prepareCurrentNotePush(): Promise<PushPreview> {
		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile) || file.extension !== "md") {
			throw new Error(t("pushNoActiveFile"));
		}

		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;
		const subjectId = Number(frontmatter?.bangumi_id);
		const localStatus = String(frontmatter?.status ?? "");
		const localCollectionType = this.parseWritableStatus(localStatus);

		if (!Number.isInteger(subjectId) || subjectId <= 0) {
			throw new Error(t("pushInvalidNote"));
		}
		if (localCollectionType === null) {
			throw new Error(t("pushStatusUnsupported"));
		}

		const content = await this.app.vault.read(file);
		const syncBlock = this.extractSyncBlock(content);
		const localItems = this.parseChecklist(syncBlock);
		if (localItems.length === 0) {
			throw new Error(t("pushChecklistMissing"));
		}

		const [remoteEpisodes, remoteCollection] = await Promise.all([
			this.fetchAllSubjectEpisodeCollections(subjectId),
			this.client.getSubjectCollection(subjectId)
		]);
		const remoteEpisodeMap = new Map<number, boolean>();
		for (const item of remoteEpisodes) {
			const episodeId = item.episode?.id;
			if (typeof episodeId === "number") {
				remoteEpisodeMap.set(episodeId, item.type > 0);
			}
		}

		const markDone: PushEpisodeChange[] = [];
		const markUndone: PushEpisodeChange[] = [];
		const unknownEpisodeIds: number[] = [];
		for (const item of localItems) {
			const remoteChecked = remoteEpisodeMap.get(item.episodeId);
			if (remoteChecked === undefined) {
				unknownEpisodeIds.push(item.episodeId);
				continue;
			}
			if (item.checked === remoteChecked) {
				continue;
			}

			const change: PushEpisodeChange = {
				episodeId: item.episodeId,
				sort: item.sort,
				title: item.title,
				localChecked: item.checked,
				remoteChecked
			};
			if (item.checked) {
				markDone.push(change);
			} else {
				markUndone.push(change);
			}
		}

		return {
			file,
			subjectId,
			localStatus: localStatus as "do" | "collect",
			localCollectionType,
			remoteCollectionType: remoteCollection.type,
			markDone,
			markUndone,
			unknownEpisodeIds
		};
	}

	async executePreparedPush(preview: PushPreview): Promise<PushResult> {
		if (preview.markDone.length > 0) {
			await this.client.patchSubjectEpisodeCollections({
				subjectId: preview.subjectId,
				episodeIds: preview.markDone.map((change) => change.episodeId),
				type: 2
			});
		}

		if (preview.markUndone.length > 0) {
			await this.client.patchSubjectEpisodeCollections({
				subjectId: preview.subjectId,
				episodeIds: preview.markUndone.map((change) => change.episodeId),
				type: 0
			});
		}

		const remoteAfterEpisodes = await this.client.getSubjectCollection(
			preview.subjectId
		);
		const serverChangedStatus =
			remoteAfterEpisodes.type !== preview.remoteCollectionType &&
			remoteAfterEpisodes.type !== preview.localCollectionType;

		if (serverChangedStatus) {
			return {
				changedEpisodes:
					preview.markDone.length + preview.markUndone.length,
				statusChanged: false,
				remoteStatusChanged: true,
				finalStatus: collectionStatusLabel(remoteAfterEpisodes.type),
				shouldResync: true
			};
		}

		let statusChanged = false;
		let finalCollectionType = remoteAfterEpisodes.type;
		if (remoteAfterEpisodes.type !== preview.localCollectionType) {
			await this.client.patchSubjectCollection({
				subjectId: preview.subjectId,
				type: preview.localCollectionType
			});
			statusChanged = true;
			finalCollectionType = preview.localCollectionType;
		}

		return {
			changedEpisodes: preview.markDone.length + preview.markUndone.length,
			statusChanged,
			remoteStatusChanged: false,
			finalStatus: collectionStatusLabel(finalCollectionType),
			shouldResync: statusChanged
		};
	}

	hasChanges(preview: PushPreview): boolean {
		return (
			preview.markDone.length > 0 ||
			preview.markUndone.length > 0 ||
			preview.unknownEpisodeIds.length > 0 ||
			preview.remoteCollectionType !== preview.localCollectionType
		);
	}

	private extractSyncBlock(content: string): string {
		const start = content.indexOf(SYNC_BLOCK_START);
		const end = content.indexOf(SYNC_BLOCK_END);
		if (start === -1 || end === -1 || end < start) {
			throw new Error(t("pushChecklistMissing"));
		}

		return content.slice(start, end + SYNC_BLOCK_END.length);
	}

	private parseChecklist(syncBlock: string): ParsedChecklistItem[] {
		const items: ParsedChecklistItem[] = [];
		const linePattern =
			/^\s*-\s+\[([ xX])\]\s+(.*?)\s*<!--\s*bgm-ep:(\d+)([^>]*)-->/;

		for (const line of syncBlock.split(/\r?\n/)) {
			const match = line.match(linePattern);
			if (!match) {
				continue;
			}

			const metadata = match[4] ?? "";
			const sortMatch = metadata.match(/\bsort:([^\s>]+)/);
			items.push({
				checked: match[1].toLowerCase() === "x",
				title: match[2].trim(),
				episodeId: Number(match[3]),
				sort: sortMatch?.[1] ?? ""
			});
		}

		return items;
	}

	private parseWritableStatus(
		status: string
	): BangumiCollectionType | null {
		if (status === "do") {
			return BANGUMI_COLLECTION_TYPES.do;
		}
		if (status === "collect") {
			return BANGUMI_COLLECTION_TYPES.collect;
		}
		return null;
	}

	private fetchAllSubjectEpisodeCollections(
		subjectId: number
	): Promise<BangumiEpisodeCollection[]> {
		return this.client.getAllSubjectEpisodeCollections(subjectId);
	}
}
