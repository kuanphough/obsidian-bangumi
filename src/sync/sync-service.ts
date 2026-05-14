import { App, TFile, normalizePath } from "obsidian";

import {
	BangumiCollection,
	BangumiCollectionType,
	BangumiEpisodeCollection,
	BANGUMI_COLLECTION_TYPES,
	BangumiSubjectType
} from "../bangumi/types";
import { BangumiClient } from "../bangumi/client";
import {
	BANGUMI_STORAGE_LAYOUTS,
	BangumiStorageLayout,
	BangumiSyncSettings
} from "../settings";
import { t } from "../i18n";
import { MarkdownRenderer } from "./markdown-renderer";
import { NoteWriter } from "./note-writer";

export interface SyncResult {
	synced: number;
	written: number;
	skipped: number;
	incrementalSkipped: number;
	failed: number;
	totalCollections: number;
	failures: SyncFailure[];
	reportPath?: string;
	message: string;
}

export interface SyncFailure {
	stage: string;
	error: string;
	subjectId?: number;
	title?: string;
	subjectType?: string;
	collectionStatus?: string;
}

export interface SyncProgress {
	stage: "start" | "user" | "fetch" | "write" | "summary" | "report" | "complete";
	message: string;
	current?: number;
	total?: number;
}

export interface SyncOptions {
	onProgress?: (progress: SyncProgress) => void;
}

const PAGE_LIMIT = 50;
const REPORT_FILE_NAME = "Bangumi Sync Report.md";

export class SyncService {
	constructor(
		private readonly app: App,
		private readonly settings: BangumiSyncSettings
	) {}

	async sync(options: SyncOptions = {}): Promise<SyncResult> {
		if (!this.settings.accessToken) {
			return {
				synced: 0,
				written: 0,
				skipped: 0,
				incrementalSkipped: 0,
				failed: 0,
				totalCollections: 0,
				failures: [],
				message: t("noToken")
			};
		}

		if (this.settings.collectionTypes.length === 0) {
			return {
				synced: 0,
				written: 0,
				skipped: 0,
				incrementalSkipped: 0,
				failed: 0,
				totalCollections: 0,
				failures: [],
				message: t("collectionStatusRequired")
			};
		}

		if (this.settings.subjectTypes.length === 0) {
			return {
				synced: 0,
				written: 0,
				skipped: 0,
				incrementalSkipped: 0,
				failed: 0,
				totalCollections: 0,
				failures: [],
				message: t("subjectTypeRequired")
			};
		}

		const collectionTypes = this.getEffectiveCollectionTypes();
		if (collectionTypes.length === 0) {
			return {
				synced: 0,
				written: 0,
				skipped: 0,
				incrementalSkipped: 0,
				failed: 0,
				totalCollections: 0,
				failures: [],
				message: t("activeStatusRequired")
			};
		}

		options.onProgress?.({
			stage: "start",
			message: t("progressStarted")
		});

		const client = new BangumiClient({
			accessToken: this.settings.accessToken,
			userAgent: this.settings.userAgent
		});
		const username = this.settings.username || (await client.getMe()).username;
		options.onProgress?.({
			stage: "user",
			message: t("connectedAs", { username })
		});

		const writer = new NoteWriter(
			this.app,
			new MarkdownRenderer(this.settings.subjectNoteTemplate),
			this.settings.fileNameFormat
		);
		const seenSubjectIds = new Set<number>();
		const failures: SyncFailure[] = [];
		const syncStartedAt = new Date().toISOString();
		let written = 0;
		let skipped = 0;
		let incrementalSkipped = 0;
		let totalCollections = 0;
		let hasBlockingFailure = false;

		for (const subjectType of this.settings.subjectTypes) {
			for (const collectionType of collectionTypes) {
				const subjectTypeName = this.renderSubjectType(subjectType);
				const collectionStatus = this.renderCollectionStatus(collectionType);

				let collections: BangumiCollection[];
				try {
					collections = await this.fetchAllCollections(
						client,
						username,
						subjectType,
						collectionType
					);
					totalCollections += collections.length;
				} catch (error) {
					hasBlockingFailure = true;
					failures.push({
						stage: t("fetchCollectionsStage"),
						subjectType: subjectTypeName,
						collectionStatus,
						error: this.getErrorMessage(error)
					});
					console.error(
						`Bangumi Sync failed to fetch subject type ${subjectType}, collection type ${collectionType}`,
						error
					);
					continue;
				}

				let groupProcessed = 0;
				let groupWritten = 0;
				let groupSkipped = 0;
				let groupUnchanged = 0;

				for (const collection of collections) {
					const subjectId = collection.subject.id;
					const title = this.getSubjectTitle(collection);
					if (seenSubjectIds.has(subjectId)) {
						skipped += 1;
						groupSkipped += 1;
						groupProcessed += 1;
						continue;
					}
					seenSubjectIds.add(subjectId);

					if (this.shouldSkipUnchanged(collection)) {
						incrementalSkipped += 1;
						groupUnchanged += 1;
						groupProcessed += 1;
						continue;
					}

					let episodes: BangumiEpisodeCollection[] = [];
					let episodeSyncError: string | undefined;
					try {
						episodes = await this.fetchAllEpisodeCollections(client, subjectId);
					} catch (error) {
						episodeSyncError = this.getErrorMessage(error);
						failures.push({
							stage: t("fetchEpisodesStage"),
							subjectId,
							title,
							subjectType: this.renderSubjectType(collection.subject.type),
							collectionStatus: this.renderCollectionStatus(collection.type),
							error: episodeSyncError
						});
						console.error(
							`Bangumi Sync failed to fetch episodes for subject ${subjectId}`,
							error
						);
					}

					try {
						await writer.writeSubjectNote(
							this.settings.syncDirectory,
							this.getTargetDirectory(collection),
							{
								collection,
								episodes,
								episodeSyncError
							}
						);
						written += 1;
						groupWritten += 1;
					} catch (error) {
						hasBlockingFailure = true;
						failures.push({
							stage: t("writeNoteStage"),
							subjectId,
							title,
							subjectType: this.renderSubjectType(collection.subject.type),
							collectionStatus: this.renderCollectionStatus(collection.type),
							error: this.getErrorMessage(error)
						});
						console.error(
							`Bangumi Sync failed to write subject ${subjectId}`,
							error
						);
					}
					groupProcessed += 1;
				}

				options.onProgress?.({
					stage: "summary",
					message: t("syncGroupProgress", {
						subjectType: subjectTypeName,
						collectionStatus,
						current: groupProcessed,
						total: collections.length,
						written: groupWritten,
						skipped: groupSkipped,
						unchanged: groupUnchanged
					}),
					current: groupProcessed,
					total: collections.length
				});
			}
		}

		let reportPath: string | undefined;
		if (failures.length > 0) {
			options.onProgress?.({
				stage: "report",
				message: t("reportWriting")
			});
			reportPath = await this.writeFailureReport({
				username,
				totalCollections,
				written,
				skipped,
				incrementalSkipped,
				failures
			});
		}

		if (!hasBlockingFailure) {
			this.settings.lastSyncedAt = syncStartedAt;
		}

		const message = t("syncFinished", {
			username,
			written,
			skipped,
			incrementalSkipped,
			failed: failures.length,
			reportCreated: reportPath ? t("reportCreated") : ""
		});
		options.onProgress?.({
			stage: "complete",
			message
		});

		return {
			synced: written,
			written,
			skipped,
			incrementalSkipped,
			failed: failures.length,
			totalCollections,
			failures,
			reportPath,
			message
		};
	}

	private async fetchAllCollections(
		client: BangumiClient,
		username: string,
		subjectType: BangumiSubjectType,
		collectionType: BangumiCollectionType
	): Promise<BangumiCollection[]> {
		const collections: BangumiCollection[] = [];
		let offset = 0;
		let total = Number.POSITIVE_INFINITY;

		while (offset < total) {
			const page = await client.getCollections({
				username,
				subjectType,
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

	private getEffectiveCollectionTypes(): BangumiCollectionType[] {
		if (this.settings.includeOnHoldAndDropped) {
			return this.settings.collectionTypes;
		}

		return this.settings.collectionTypes.filter(
			(type) =>
				type !== BANGUMI_COLLECTION_TYPES.onHold &&
				type !== BANGUMI_COLLECTION_TYPES.dropped
		);
	}

	private shouldSkipUnchanged(collection: BangumiCollection): boolean {
		if (!this.settings.incrementalSync || !this.settings.lastSyncedAt) {
			return false;
		}

		const updatedAt = Date.parse(collection.updated_at ?? "");
		const lastSyncedAt = Date.parse(this.settings.lastSyncedAt);
		if (Number.isNaN(updatedAt) || Number.isNaN(lastSyncedAt)) {
			return false;
		}

		return updatedAt <= lastSyncedAt;
	}

	private async fetchAllEpisodeCollections(
		client: BangumiClient,
		subjectId: number
	): Promise<BangumiEpisodeCollection[]> {
		const page = await client.getSubjectEpisodeCollections(subjectId);
		return page.data
			.filter((item) => item.episode !== null)
			.sort((left, right) => {
				const leftSort = left.episode?.sort ?? 0;
				const rightSort = right.episode?.sort ?? 0;
				return leftSort - rightSort;
			});
	}

	private getTargetDirectory(collection: BangumiCollection): string {
		const root = this.settings.syncDirectory;
		const subjectType = this.renderSubjectType(collection.subject.type);
		const collectionStatus = this.renderCollectionStatus(collection.type);

		switch (this.settings.storageLayout as BangumiStorageLayout) {
			case BANGUMI_STORAGE_LAYOUTS.subjectThenCollection:
				return `${root}/${subjectType}/${collectionStatus}`;
			case BANGUMI_STORAGE_LAYOUTS.collectionThenSubject:
				return `${root}/${collectionStatus}/${subjectType}`;
			case BANGUMI_STORAGE_LAYOUTS.flat:
			default:
				return root;
		}
	}

	private async writeFailureReport(params: {
		username: string;
		totalCollections: number;
		written: number;
		skipped: number;
		incrementalSkipped: number;
		failures: SyncFailure[];
	}): Promise<string> {
		const directory = normalizePath(this.settings.syncDirectory);
		await this.ensureFolder(directory);
		const path = normalizePath(`${directory}/${REPORT_FILE_NAME}`);
		const content = this.renderFailureReport(params);
		const existing = this.app.vault.getAbstractFileByPath(path);

		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
		} else {
			await this.app.vault.create(path, content);
		}

		return path;
	}

	private renderFailureReport(params: {
		username: string;
		totalCollections: number;
		written: number;
		skipped: number;
		incrementalSkipped: number;
		failures: SyncFailure[];
	}): string {
		return [
			`# ${t("reportTitle")}`,
			"",
			`- ${t("syncedAt")}: ${new Date().toISOString()}`,
			`- ${t("user")}: ${params.username}`,
			`- ${t("collectionsFetched")}: ${params.totalCollections}`,
			`- ${t("notesSynced")}: ${params.written}`,
			`- ${t("skipped")}: ${params.skipped}`,
			`- ${t("incrementalSkipped")}: ${params.incrementalSkipped}`,
			`- ${t("issues")}: ${params.failures.length}`,
			"",
			`## ${t("reportFailures")}`,
			"",
			...params.failures.flatMap((failure, index) => [
				`### ${index + 1}. ${failure.title ?? failure.stage}`,
				"",
				`- ${t("reportStage")}: ${failure.stage}`,
				failure.subjectId ? `- ${t("subjectId")}: ${failure.subjectId}` : "",
				failure.subjectType ? `- ${t("subjectType")}: ${failure.subjectType}` : "",
				failure.collectionStatus
					? `- ${t("collectionStatus")}: ${failure.collectionStatus}`
					: "",
				`- ${t("error")}: ${failure.error}`,
				""
			])
		]
			.filter((line) => line !== "")
			.join("\n");
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

	private getSubjectTitle(collection: BangumiCollection): string {
		return collection.subject.name_cn || collection.subject.name;
	}

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}

	private renderCollectionStatus(type: number): string {
		switch (type) {
			case 1:
				return "wish";
			case 2:
				return "collect";
			case 3:
				return "do";
			case 4:
				return "on_hold";
			case 5:
				return "dropped";
			default:
				return String(type);
		}
	}

	private renderSubjectType(type: number): string {
		switch (type) {
			case 1:
				return "book";
			case 2:
				return "anime";
			case 3:
				return "music";
			case 4:
				return "game";
			case 6:
				return "real";
			default:
				return String(type);
		}
	}
}
