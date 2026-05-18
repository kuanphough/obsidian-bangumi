import { App, TFile, moment, normalizePath } from "obsidian";

import {
	BangumiCollection,
	BangumiCollectionType,
	BangumiEpisodeCollection,
	BANGUMI_COLLECTION_TYPES,
	BANGUMI_SUBJECT_TYPES,
	BangumiSubjectExtras
} from "../bangumi/types";
import { BangumiClient } from "../bangumi/client";
import { collectionStatusLabel, subjectTypeLabel } from "../bangumi/labels";
import { formatLocalDateTime } from "../date-format";
import {
	BANGUMI_STORAGE_LAYOUTS,
	BangumiSyncSettings
} from "../settings";
import { t } from "../i18n";
import { mapWithConcurrency } from "../utils/concurrency";
import { ensureFolder } from "../utils/vault";
import {
	DEFAULT_SUBJECT_NOTE_TEMPLATE,
	MarkdownRenderer
} from "./markdown-renderer";
import { NoteWriter } from "./note-writer";
import { SubjectNoteIndex } from "./subject-note-index";

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
	stage:
		| "start"
		| "user"
		| "fetch"
		| "write"
		| "summary"
		| "warning"
		| "report"
		| "complete";
	message: string;
	current?: number;
	total?: number;
}

export interface SyncOptions {
	onProgress?: (progress: SyncProgress) => void;
}

export interface SyncSingleSubjectResult {
	changed: boolean;
	path: string;
	episodeSyncError?: string;
}

const PAGE_LIMIT = 50;
const REPORT_FILE_NAME = "Bangumi Sync Report.md";
const DAILY_SYNC_BLOCK_START = "<!-- bangumi-daily-sync-start -->";
const DAILY_SYNC_BLOCK_END = "<!-- bangumi-daily-sync-end -->";

interface DailySyncEntry {
	collection: BangumiCollection;
	episodes: BangumiEpisodeCollection[];
	episodeSyncError?: string;
}

interface DailyNotesOptions {
	folder?: string;
	format?: string;
}

interface DailyNotesPlugin {
	instance?: {
		options?: DailyNotesOptions;
	};
	options?: DailyNotesOptions;
}

export class SyncService {
	constructor(
		private readonly app: App,
		private readonly settings: BangumiSyncSettings,
		private readonly clientFactory: () => BangumiClient = () =>
			new BangumiClient({
				accessToken: settings.accessToken,
				userAgent: settings.userAgent
			})
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

		const client = this.clientFactory();
		const username = this.settings.username || (await client.getMe()).username;
		options.onProgress?.({
			stage: "user",
			message: t("connectedAs", { username })
		});

		const writer = this.createNoteWriter();
		const noteIndex = SubjectNoteIndex.build(
			this.app,
			this.settings.syncDirectory
		);
		const seenSubjectIds = new Set<number>();
		const failures: SyncFailure[] = [];
		const syncStartedAt = new Date().toISOString();
		let written = 0;
		let skipped = 0;
		let incrementalSkipped = 0;
		let totalCollections = 0;
		let hasBlockingFailure = false;
		const dailySyncEntries: DailySyncEntry[] = [];
		const dailyNoteSyncAvailable = await this.validateDailyNoteSyncTarget(
			options
		);

		const concurrency = this.settings.syncConcurrency || 1;

		for (const subjectType of this.settings.subjectTypes) {
			for (const collectionType of collectionTypes) {
				const subjectTypeName = subjectTypeLabel(subjectType);
				const collectionStatus = collectionStatusLabel(collectionType);

				let collections: BangumiCollection[];
				try {
					collections = await client.getAllUserCollections({
						username,
						subjectType,
						collectionType,
						pageSize: PAGE_LIMIT
					});
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

				let groupWritten = 0;
				let groupSkipped = 0;
				let groupUnchanged = 0;

				const workItems: BangumiCollection[] = [];
				for (const collection of collections) {
					const subjectId = collection.subject.id;
					if (seenSubjectIds.has(subjectId)) {
						skipped += 1;
						groupSkipped += 1;
						continue;
					}
					seenSubjectIds.add(subjectId);

					if (
						this.shouldSkipUnchanged(collection) &&
						noteIndex.has(subjectId)
					) {
						incrementalSkipped += 1;
						groupUnchanged += 1;
						continue;
					}
					workItems.push(collection);
				}

				await mapWithConcurrency(workItems, concurrency, async (collection) => {
					const subjectId = collection.subject.id;
					const title = this.getSubjectTitle(collection);

					const [episodesResult, extras] = await Promise.all([
						this.safeFetchEpisodeCollections(
							client,
							collection,
							title,
							failures
						),
						this.fetchSubjectExtras(client, collection, failures)
					]);
					const { episodes, episodeSyncError } = episodesResult;

					try {
						const result = await writer.writeSubjectNote(
							this.getTargetDirectory(collection),
							{
								collection,
								episodes,
								episodeSyncError,
								extras
							},
							noteIndex
						);
						if (result.changed) {
							written += 1;
							groupWritten += 1;
						} else {
							incrementalSkipped += 1;
							groupUnchanged += 1;
						}
						if (
							result.changed &&
							this.settings.dailyNoteSync &&
							dailyNoteSyncAvailable &&
							collection.type === BANGUMI_COLLECTION_TYPES.do
						) {
							dailySyncEntries.push({
								collection,
								episodes,
								episodeSyncError
							});
						}
					} catch (error) {
						hasBlockingFailure = true;
						failures.push({
							stage: t("writeNoteStage"),
							subjectId,
							title,
							subjectType: subjectTypeLabel(collection.subject.type),
							collectionStatus: collectionStatusLabel(collection.type),
							error: this.getErrorMessage(error)
						});
						console.error(
							`Bangumi Sync failed to write subject ${subjectId}`,
							error
						);
					}
				});

				const groupProcessed = groupWritten + groupSkipped + groupUnchanged;
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

		if (this.settings.dailyNoteSync && dailySyncEntries.length > 0) {
			try {
				await this.writeDailyNoteSyncBlock(dailySyncEntries);
			} catch (error) {
				this.recordDailyNoteSyncWarning(options, this.getErrorMessage(error));
				console.error("Bangumi Sync failed to write daily note sync block", error);
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

	async syncSubjectCollection(
		collection: BangumiCollection
	): Promise<SyncSingleSubjectResult> {
		if (!this.settings.accessToken) {
			throw new Error(t("noToken"));
		}

		const client = this.clientFactory();
		const writer = this.createNoteWriter();
		const subjectId = collection.subject.id;
		let episodes: BangumiEpisodeCollection[] = [];
		let episodeSyncError: string | undefined;
		const failures: SyncFailure[] = [];

		if (this.shouldFetchEpisodeCollections(collection)) {
			try {
				episodes = await this.fetchAllEpisodeCollections(client, subjectId);
			} catch (error) {
				episodeSyncError = this.getErrorMessage(error);
				console.error(
					`Bangumi Sync failed to fetch episodes for subject ${subjectId}`,
					error
				);
			}
		}

		const extras = await this.fetchSubjectExtras(client, collection, failures);
		const noteIndex = SubjectNoteIndex.build(
			this.app,
			this.settings.syncDirectory
		);
		const result = await writer.writeSubjectNote(
			this.getTargetDirectory(collection),
			{
				collection,
				episodes,
				episodeSyncError,
				extras
			},
			noteIndex
		);

		return {
			changed: result.changed,
			path: result.file.path,
			episodeSyncError: episodeSyncError ?? extras.errors?.join("; ")
		};
	}

	private async safeFetchEpisodeCollections(
		client: BangumiClient,
		collection: BangumiCollection,
		title: string,
		failures: SyncFailure[]
	): Promise<{
		episodes: BangumiEpisodeCollection[];
		episodeSyncError?: string;
	}> {
		const subjectId = collection.subject.id;
		if (!this.shouldFetchEpisodeCollections(collection)) {
			return { episodes: [] };
		}
		try {
			const episodes = await this.fetchAllEpisodeCollections(client, subjectId);
			return { episodes };
		} catch (error) {
			const message = this.getErrorMessage(error);
			failures.push({
				stage: t("fetchEpisodesStage"),
				subjectId,
				title,
				subjectType: subjectTypeLabel(collection.subject.type),
				collectionStatus: collectionStatusLabel(collection.type),
				error: message
			});
			console.error(
				`Bangumi Sync failed to fetch episodes for subject ${subjectId}`,
				error
			);
			return { episodes: [], episodeSyncError: message };
		}
	}

	private async fetchSubjectExtras(
		client: BangumiClient,
		collection: BangumiCollection,
		failures: SyncFailure[]
	): Promise<BangumiSubjectExtras> {
		const subjectId = collection.subject.id;
		const title = this.getSubjectTitle(collection);
		const extras: BangumiSubjectExtras = {};
		const errors: string[] = [];

		const tasks: Array<Promise<void>> = [];

		if (this.shouldFetchDetailedSubjectInfo()) {
			tasks.push(
				client
					.getSubject(subjectId)
					.then((detailed) => {
						collection.subject = { ...collection.subject, ...detailed };
					})
					.catch((error) => {
						this.recordExtraFailure(
							failures,
							errors,
							collection,
							title,
							"fetch detailed subject info",
							error
						);
					})
			);
		}

		if (this.shouldFetchStaff()) {
			tasks.push(
				client
					.getSubjectPersons(subjectId)
					.then((staff) => {
						extras.staff = staff;
					})
					.catch((error) => {
						this.recordExtraFailure(
							failures,
							errors,
							collection,
							title,
							"fetch staff",
							error
						);
					})
			);
		}

		if (this.shouldFetchCharacters()) {
			tasks.push(
				client
					.getSubjectCharacters(subjectId)
					.then((characters) => {
						extras.characters = characters;
					})
					.catch((error) => {
						this.recordExtraFailure(
							failures,
							errors,
							collection,
							title,
							"fetch characters",
							error
						);
					})
			);
		}

		if (this.shouldFetchRelations()) {
			tasks.push(
				client
					.getRelatedSubjects(subjectId)
					.then((relations) => {
						extras.relations = relations;
					})
					.catch((error) => {
						this.recordExtraFailure(
							failures,
							errors,
							collection,
							title,
							"fetch relations",
							error
						);
					})
			);
		}

		await Promise.all(tasks);

		if (errors.length > 0) {
			extras.errors = errors;
		}

		return extras;
	}

	private recordExtraFailure(
		failures: SyncFailure[],
		errors: string[],
		collection: BangumiCollection,
		title: string,
		stage: string,
		error: unknown
	): void {
		const message = this.getErrorMessage(error);
		errors.push(`${stage}: ${message}`);
		failures.push({
			stage,
			subjectId: collection.subject.id,
			title,
			subjectType: subjectTypeLabel(collection.subject.type),
			collectionStatus: collectionStatusLabel(collection.type),
			error: message
		});
		console.error(
			`Bangumi Sync failed to ${stage} for subject ${collection.subject.id}`,
			error
		);
	}

	private shouldFetchDetailedSubjectInfo(): boolean {
		return (
			this.settings.fetchDetailedSubjectInfo ||
			this.templateUsesAny([
				"summary_section",
				"subject_summary",
				"subject_infobox",
				"subject_infobox_json",
				"subject_tags",
				"subject_tags_json",
				"subject_rating",
				"subject_rating_json",
				"subject_collection_stats",
				"subject_collection_stats_json"
			])
		);
	}

	private shouldFetchStaff(): boolean {
		return this.settings.fetchStaff || this.templateUsesAny(["staff", "staff_json"]);
	}

	private shouldFetchCharacters(): boolean {
		return (
			this.settings.fetchCharacters ||
			this.templateUsesAny(["characters", "characters_json"])
		);
	}

	private shouldFetchRelations(): boolean {
		return (
			this.settings.fetchRelations ||
			this.templateUsesAny(["relations", "relations_json"])
		);
	}

	private templateUsesAny(variables: string[]): boolean {
		const template = this.getEffectiveTemplate();
		return variables.some((variable) =>
			template.includes(`{{${variable}}`) ||
			template.includes(`{{ ${variable}`)
		);
	}

	private getEffectiveTemplate(): string {
		const template = this.settings.subjectNoteTemplate;
		return template.includes("{{sync_block_start}}") &&
			template.includes("{{sync_block_end}}")
			? template
			: DEFAULT_SUBJECT_NOTE_TEMPLATE;
	}

	private createNoteWriter(): NoteWriter {
		return new NoteWriter(
			this.app,
			new MarkdownRenderer(this.settings.subjectNoteTemplate),
			this.settings.fileNameFormat
		);
	}

	private async validateDailyNoteSyncTarget(
		options: SyncOptions
	): Promise<boolean> {
		if (!this.settings.dailyNoteSync) {
			return false;
		}

		const path = this.getDailyNotePath();
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (!(existing instanceof TFile)) {
			this.recordDailyNoteSyncWarning(
				options,
				t("dailyNoteSyncNoteMissing", { path })
			);
			return false;
		}

		const content = await this.app.vault.read(existing);
		if (!this.hasDailySyncMarkers(content)) {
			this.recordDailyNoteSyncWarning(
				options,
				t("dailyNoteSyncMarkersMissing")
			);
			return false;
		}

		return true;
	}

	private recordDailyNoteSyncWarning(
		options: SyncOptions,
		message: string
	): void {
		options.onProgress?.({
			stage: "warning",
			message
		});
	}

	private async writeDailyNoteSyncBlock(entries: DailySyncEntry[]): Promise<void> {
		const path = this.getDailyNotePath();
		const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
		if (folder) {
			await ensureFolder(this.app,folder);
		}

		const existing = this.app.vault.getAbstractFileByPath(path);
		const nextBlock = this.renderDailySyncBlock(entries);

		if (existing instanceof TFile) {
			const previous = await this.app.vault.read(existing);
			await this.app.vault.modify(
				existing,
				this.mergeDailySyncBlock(previous, nextBlock)
			);
			return;
		}

		throw new Error(t("dailyNoteSyncNoteMissing", { path }));
	}

	private renderDailySyncBlock(entries: DailySyncEntry[]): string {
		const date = moment().format("YYYY-MM-DD");
		const rows = entries.map((entry) => this.renderDailySyncRow(entry, date));

		return [
			DAILY_SYNC_BLOCK_START,
			...rows,
			DAILY_SYNC_BLOCK_END,
			""
		].join("\n");
	}

	private renderDailySyncRow(entry: DailySyncEntry, date: string): string {
		const collection = entry.collection;
		const progress = this.getDailyProgress(entry);
		const title = this.getSubjectTitle(collection);
		const subjectId = collection.subject.id;

		return `- [x] [${this.escapeMarkdownLinkText(title)}](https://bgm.tv/subject/${subjectId}) 进度：${progress} ✅ ${date}`;
	}

	private getDailyProgress(entry: DailySyncEntry): string {
		if (entry.episodeSyncError || entry.episodes.length === 0) {
			return "N/A";
		}

		const validEpisodes = entry.episodes.filter((item) => item.episode !== null);
		const done = validEpisodes.filter((item) => item.type > 0).length;
		const total = entry.collection.subject.eps || validEpisodes.length;
		return total > 0 ? `${done}/${total}` : String(done);
	}

	private getProgressSummary(entry: DailySyncEntry): {
		progress: string;
		next: string;
	} {
		if (entry.episodeSyncError || entry.episodes.length === 0) {
			return { progress: "N/A", next: "N/A" };
		}

		const validEpisodes = entry.episodes.filter((item) => item.episode !== null);
		const total = entry.collection.subject.eps || validEpisodes.length;
		const done = validEpisodes.filter((item) => item.type > 0).length;
		const next = validEpisodes.find((item) => item.type <= 0)?.episode;

		return {
			progress: total > 0 ? `${done} / ${total}` : "N/A",
			next: next ? this.getEpisodeTitle(next) : "N/A"
		};
	}

	private mergeDailySyncBlock(
		existingContent: string,
		nextBlock: string
	): string {
		if (!this.hasDailySyncMarkers(existingContent)) {
			throw new Error(t("dailyNoteSyncMarkersMissing"));
		}

		const start = existingContent.indexOf(DAILY_SYNC_BLOCK_START);
		const end = existingContent.indexOf(DAILY_SYNC_BLOCK_END);
		const mergedBlock = this.mergeDailySyncRows(
			existingContent.slice(start, end + DAILY_SYNC_BLOCK_END.length),
			nextBlock
		);

		return `${existingContent.slice(0, start)}${mergedBlock}${existingContent.slice(end + DAILY_SYNC_BLOCK_END.length)}`;
	}

	private hasDailySyncMarkers(content: string): boolean {
		const start = content.indexOf(DAILY_SYNC_BLOCK_START);
		const end = content.indexOf(DAILY_SYNC_BLOCK_END);
		return start !== -1 && end !== -1 && end > start;
	}

	private mergeDailySyncRows(existingBlock: string, nextBlock: string): string {
		const rowsBySubjectId = new Map<number, string>();
		const orderedSubjectIds: number[] = [];

		for (const row of this.extractDailySyncRows(existingBlock)) {
			const subjectId = this.extractSubjectId(row);
			if (subjectId === null) {
				continue;
			}
			rowsBySubjectId.set(subjectId, row);
			orderedSubjectIds.push(subjectId);
		}

		for (const row of this.extractDailySyncRows(nextBlock)) {
			const subjectId = this.extractSubjectId(row);
			if (subjectId === null) {
				continue;
			}
			if (!rowsBySubjectId.has(subjectId)) {
				orderedSubjectIds.push(subjectId);
			}
			rowsBySubjectId.set(subjectId, row);
		}

		return [
			DAILY_SYNC_BLOCK_START,
			...orderedSubjectIds.map((subjectId) => rowsBySubjectId.get(subjectId) ?? ""),
			DAILY_SYNC_BLOCK_END
		].join("\n");
	}

	private extractDailySyncRows(block: string): string[] {
		return block
			.split("\n")
			.map((line) => line.trimEnd())
			.filter((line) => line.startsWith("- ["));
	}

	private extractSubjectId(row: string): number | null {
		const match = row.match(/https:\/\/bgm\.tv\/subject\/(\d+)/);
		return match ? Number(match[1]) : null;
	}

	private getDailyNotePath(): string {
		const options = this.getDailyNotesOptions();
		const fileName = `${moment().format(options.format || "YYYY-MM-DD")}.md`;
		const folder = normalizePath(options.folder || "");
		return normalizePath(folder ? `${folder}/${fileName}` : fileName);
	}

	private getDailyNotesOptions(): DailyNotesOptions {
		const internalPlugins = (
			this.app as App & {
				internalPlugins?: {
					getPluginById(id: string): DailyNotesPlugin | undefined;
				};
			}
		).internalPlugins;
		const dailyNotes = internalPlugins?.getPluginById("daily-notes");
		return dailyNotes?.instance?.options ?? dailyNotes?.options ?? {};
	}

	private escapeMarkdownLinkText(value: string): string {
		return value.replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\n/g, " ");
	}

	private getEpisodeTitle(episode: {
		sort: number;
		name?: string;
		name_cn?: string;
	}): string {
		const title = episode.name_cn || episode.name || "";
		return title ? `EP${episode.sort} ${title}` : `EP${episode.sort}`;
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
		return (await client.getAllSubjectEpisodeCollections(subjectId))
			.filter((item) => item.episode !== null)
			.sort((left, right) => {
				const leftSort = left.episode?.sort ?? 0;
				const rightSort = right.episode?.sort ?? 0;
				return leftSort - rightSort;
			});
	}

	private shouldFetchEpisodeCollections(collection: BangumiCollection): boolean {
		const subjectType = collection.subject.type;
		const collectionType = collection.type;
		const subjectSupportsProgress =
			subjectType === BANGUMI_SUBJECT_TYPES.book ||
			subjectType === BANGUMI_SUBJECT_TYPES.anime ||
			subjectType === BANGUMI_SUBJECT_TYPES.real;
		const collectionSupportsProgress =
			collectionType === BANGUMI_COLLECTION_TYPES.wish ||
			collectionType === BANGUMI_COLLECTION_TYPES.do ||
			collectionType === BANGUMI_COLLECTION_TYPES.collect;
		return subjectSupportsProgress && collectionSupportsProgress;
	}

	private getTargetDirectory(collection: BangumiCollection): string {
		const root = this.settings.syncDirectory;
		const subjectType = subjectTypeLabel(collection.subject.type);
		const collectionStatus = collectionStatusLabel(collection.type);

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

	private async writeFailureReport(params: {
		username: string;
		totalCollections: number;
		written: number;
		skipped: number;
		incrementalSkipped: number;
		failures: SyncFailure[];
	}): Promise<string> {
		const directory = normalizePath(this.settings.syncDirectory);
		await ensureFolder(this.app,directory);
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
			`- ${t("syncedAt")}: ${formatLocalDateTime(new Date())}`,
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
				`### ${index + 1}. ${failure.title ?? this.getFailureReportStage(failure)}`,
				"",
				`- ${t("reportStage")}: ${this.getFailureReportStage(failure)}`,
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

	private getFailureReportStage(failure: SyncFailure): string {
		if (failure.stage === t("fetchEpisodesStage")) {
			return t("progressUnavailableReport");
		}

		return failure.stage;
	}

	private getSubjectTitle(collection: BangumiCollection): string {
		return collection.subject.name_cn || collection.subject.name;
	}

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}
