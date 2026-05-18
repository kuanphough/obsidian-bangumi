import { App, TFile, normalizePath } from "obsidian";

import { BangumiClient } from "../bangumi/client";
import { collectionStatusLabel, subjectTypeLabel } from "../bangumi/labels";
import {
	BANGUMI_COLLECTION_TYPES,
	BANGUMI_SUBJECT_TYPES,
	BangumiCollection,
	BangumiCollectionType,
	BangumiEpisodeCollection
} from "../bangumi/types";
import {
	BANGUMI_STORAGE_LAYOUTS,
	type BangumiSyncSettings
} from "../settings";
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
	username: string;
	localStatus: string;
	localCollectionType: BangumiCollectionType;
	remoteCollectionType: BangumiCollectionType | null;
	remoteMissing: boolean;
	subjectType: number;
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
	movedPath?: string;
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
		const localItems = this.supportsEpisodePush(localCollectionType)
			? this.parseChecklist(syncBlock)
			: [];

		const username = this.settings.username || (await this.client.getMe()).username;
		const remoteCollection = await this.getSubjectCollectionOrNull(
			subjectId,
			username
		);
		const remoteMissing = remoteCollection === null;
		const remoteEpisodes =
			this.supportsEpisodePush(localCollectionType) && !remoteMissing
				? await this.fetchAllSubjectEpisodeCollections(subjectId)
				: [];
		const subjectType =
			remoteCollection?.subject.type ??
			this.parseSubjectType(String(frontmatter?.type ?? "")) ??
			(await this.client.getSubject(subjectId)).type;
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
			if (remoteMissing) {
				if (item.checked) {
					markDone.push({
						episodeId: item.episodeId,
						sort: item.sort,
						title: item.title,
						localChecked: true,
						remoteChecked: false
					});
				}
				continue;
			}
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
			username,
			localStatus,
			localCollectionType,
			remoteCollectionType: remoteCollection?.type ?? null,
			remoteMissing,
			subjectType,
			markDone,
			markUndone,
			unknownEpisodeIds
		};
	}

	async executePreparedPush(preview: PushPreview): Promise<PushResult> {
		if (preview.remoteMissing) {
			await this.client.createSubjectCollection({
				subjectId: preview.subjectId,
				type: preview.localCollectionType
			});
			const createdCollection = await this.client.getSubjectCollection(
				preview.subjectId,
				preview.username
			);
			if (createdCollection.type !== preview.localCollectionType) {
				throw new Error(
					t("pushStatusVerifyFailed", {
						expected: collectionStatusLabel(preview.localCollectionType),
						actual: collectionStatusLabel(createdCollection.type)
					})
				);
			}
		}

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

		await this.verifyEpisodeChanges(preview);

		const remoteAfterEpisodes = await this.client.getSubjectCollection(
			preview.subjectId,
			preview.username
		);
		const serverChangedStatus =
			preview.remoteCollectionType !== null &&
			remoteAfterEpisodes.type !== preview.remoteCollectionType &&
			remoteAfterEpisodes.type !== preview.localCollectionType;

		if (serverChangedStatus) {
			const movedPath = await this.moveNoteForFinalStatus(
				preview,
				remoteAfterEpisodes.type
			);
			return {
				changedEpisodes:
					preview.markDone.length + preview.markUndone.length,
				statusChanged: false,
				remoteStatusChanged: true,
				finalStatus: collectionStatusLabel(remoteAfterEpisodes.type),
				shouldResync: true,
				movedPath
			};
		}

		let statusChanged = preview.remoteMissing;
		let finalCollectionType = remoteAfterEpisodes.type;
		if (remoteAfterEpisodes.type !== preview.localCollectionType) {
			await this.client.patchSubjectCollection({
				subjectId: preview.subjectId,
				type: preview.localCollectionType
			});
			const remoteAfterStatus = await this.client.getSubjectCollection(
				preview.subjectId,
				preview.username
			);
			if (remoteAfterStatus.type !== preview.localCollectionType) {
				throw new Error(
					t("pushStatusVerifyFailed", {
						expected: collectionStatusLabel(preview.localCollectionType),
						actual: collectionStatusLabel(remoteAfterStatus.type)
					})
				);
			}
			statusChanged = true;
			finalCollectionType = remoteAfterStatus.type;
		}

		const movedPath = await this.moveNoteForFinalStatus(
			preview,
			finalCollectionType
		);

		return {
			changedEpisodes: preview.markDone.length + preview.markUndone.length,
			statusChanged,
			remoteStatusChanged: false,
			finalStatus: collectionStatusLabel(finalCollectionType),
			shouldResync: statusChanged,
			movedPath
		};
	}

	private async verifyEpisodeChanges(preview: PushPreview): Promise<void> {
		const expected = new Map<number, boolean>();
		for (const change of preview.markDone) {
			expected.set(change.episodeId, true);
		}
		for (const change of preview.markUndone) {
			expected.set(change.episodeId, false);
		}
		if (expected.size === 0) {
			return;
		}

		const remoteEpisodes = await this.fetchAllSubjectEpisodeCollections(
			preview.subjectId
		);
		const remoteEpisodeMap = new Map<number, boolean>();
		for (const item of remoteEpisodes) {
			const episodeId = item.episode?.id;
			if (typeof episodeId === "number") {
				remoteEpisodeMap.set(episodeId, item.type > 0);
			}
		}

		const failedIds: number[] = [];
		for (const [episodeId, expectedChecked] of expected) {
			if (remoteEpisodeMap.get(episodeId) !== expectedChecked) {
				failedIds.push(episodeId);
			}
		}
		if (failedIds.length > 0) {
			throw new Error(
				t("pushEpisodeVerifyFailed", {
					ids: failedIds.join(", ")
				})
			);
		}
	}

	hasChanges(preview: PushPreview): boolean {
		return (
			preview.remoteMissing ||
			preview.markDone.length > 0 ||
			preview.markUndone.length > 0 ||
			preview.unknownEpisodeIds.length > 0 ||
			preview.remoteCollectionType !== preview.localCollectionType
		);
	}

	private async getSubjectCollectionOrNull(
		subjectId: number,
		username: string
	): Promise<BangumiCollection | null> {
		try {
			return await this.client.getSubjectCollection(subjectId, username);
		} catch (error) {
			if (this.isBangumiNotFound(error)) {
				return null;
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

	private parseSubjectType(type: string): number | null {
		switch (type) {
			case "book":
				return BANGUMI_SUBJECT_TYPES.book;
			case "anime":
				return BANGUMI_SUBJECT_TYPES.anime;
			case "music":
				return BANGUMI_SUBJECT_TYPES.music;
			case "game":
				return BANGUMI_SUBJECT_TYPES.game;
			case "real":
				return BANGUMI_SUBJECT_TYPES.real;
			default:
				return null;
		}
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
		if (status === "wish") {
			return BANGUMI_COLLECTION_TYPES.wish;
		}
		if (status === "do") {
			return BANGUMI_COLLECTION_TYPES.do;
		}
		if (status === "collect") {
			return BANGUMI_COLLECTION_TYPES.collect;
		}
		if (status === "on_hold") {
			return BANGUMI_COLLECTION_TYPES.onHold;
		}
		if (status === "dropped") {
			return BANGUMI_COLLECTION_TYPES.dropped;
		}
		return null;
	}

	private supportsEpisodePush(type: BangumiCollectionType): boolean {
		return (
			type === BANGUMI_COLLECTION_TYPES.do ||
			type === BANGUMI_COLLECTION_TYPES.collect
		);
	}

	private async moveNoteForFinalStatus(
		preview: PushPreview,
		finalCollectionType: BangumiCollectionType
	): Promise<string | undefined> {
		if (this.settings.storageLayout === BANGUMI_STORAGE_LAYOUTS.flat) {
			return undefined;
		}

		const targetDirectory = normalizePath(
			this.getTargetDirectory(preview.subjectType, finalCollectionType)
		);
		await this.ensureFolder(targetDirectory);

		const fileName = preview.file.path.split("/").pop() ?? preview.file.name;
		const targetPath = normalizePath(`${targetDirectory}/${fileName}`);
		if (normalizePath(preview.file.path) === targetPath) {
			return undefined;
		}

		const existing = this.app.vault.getAbstractFileByPath(targetPath);
		if (existing instanceof TFile && existing !== preview.file) {
			throw new Error(t("pushMoveTargetExists", { path: targetPath }));
		}

		await this.app.vault.rename(preview.file, targetPath);
		return targetPath;
	}

	private getTargetDirectory(
		subjectTypeValue: number,
		collectionType: BangumiCollectionType
	): string {
		const root = this.settings.syncDirectory;
		const subjectType = subjectTypeLabel(subjectTypeValue);
		const collectionStatus = collectionStatusLabel(collectionType);

		switch (this.settings.storageLayout) {
			case BANGUMI_STORAGE_LAYOUTS.subjectThenCollection:
				return `${root}/${subjectType}/${collectionStatus}`;
			case BANGUMI_STORAGE_LAYOUTS.collectionThenSubject:
				return `${root}/${collectionStatus}/${subjectType}`;
			case BANGUMI_STORAGE_LAYOUTS.flat:
			default:
				return root;
		}
	}

	private async ensureFolder(path: string): Promise<void> {
		const parts = path.split("/").filter(Boolean);
		let current = "";

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}

	private fetchAllSubjectEpisodeCollections(
		subjectId: number
	): Promise<BangumiEpisodeCollection[]> {
		return this.client.getAllSubjectEpisodeCollections(subjectId);
	}
}
