import {
	App,
	ItemView,
	Modal,
	Notice,
	Setting,
	WorkspaceLeaf,
	normalizePath
} from "obsidian";

import type BangumiSyncPlugin from "./main";
import { collectionStatusLabel } from "./bangumi/labels";
import {
	compareEpisodesByTypeThenSort,
	episodeTypeLabel
} from "./bangumi/episodes";
import {
	BANGUMI_COLLECTION_TYPES,
	BangumiCollection,
	BangumiCollectionType,
	BangumiEpisodeCollection
} from "./bangumi/types";
import { t } from "./i18n";
import { BANGUMI_STORAGE_LAYOUTS } from "./settings";
import { SYNC_BLOCK_END, SYNC_BLOCK_START } from "./sync/markdown-renderer";
import { SyncService } from "./sync/sync-service";
import { ProgressBoardItem } from "./sync/progress-board-service";

export const VIEW_TYPE_BANGUMI_BOARD = "bangumi-progress-board";
const BOARD_TYPE_FILTERS = ["all", "anime", "book", "music", "game", "real"] as const;
type BoardTypeFilter = (typeof BOARD_TYPE_FILTERS)[number];
const BOARD_STATUS_OPTIONS: Array<{ type: BangumiCollectionType; label: string }> = [
	{ type: BANGUMI_COLLECTION_TYPES.wish, label: "wish" },
	{ type: BANGUMI_COLLECTION_TYPES.do, label: "do" },
	{ type: BANGUMI_COLLECTION_TYPES.collect, label: "collect" },
	{ type: BANGUMI_COLLECTION_TYPES.onHold, label: "on_hold" },
	{ type: BANGUMI_COLLECTION_TYPES.dropped, label: "dropped" }
];

interface BoardEpisode {
	id: number;
	type: number;
	sort: number;
	title: string;
	airdate: string;
	remoteChecked: boolean;
	localChecked: boolean;
}

export class ProgressBoardView extends ItemView {
	private items: ProgressBoardItem[] = [];
	private selectedItem: ProgressBoardItem | null = null;
	private episodes: BoardEpisode[] = [];
	private remoteStatus: BangumiCollectionType | null = null;
	private remoteComment = "";
	private remoteRating = 0;
	private loading = false;
	private selectedType: BoardTypeFilter = "anime";

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: BangumiSyncPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_BANGUMI_BOARD;
	}

	getDisplayText(): string {
		return t("boardTitle");
	}

	getIcon(): string {
		return "layout-grid";
	}

	async onOpen(): Promise<void> {
		this.refreshList();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private refreshList(forceRefresh = false): void {
		this.items = this.plugin.listProgressBoardItems(forceRefresh);
		this.selectedItem = null;
		this.episodes = [];
		this.remoteStatus = null;
		this.remoteComment = "";
		this.remoteRating = 0;
		this.renderList();
	}

	private renderList(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("bangumi-note-board");

		new Setting(contentEl)
			.setName(t("boardTitle"))
			.addDropdown((dropdown) => {
				for (const type of BOARD_TYPE_FILTERS) {
					dropdown.addOption(type, this.getTypeFilterLabel(type));
				}
				dropdown
					.setValue(this.selectedType)
					.onChange((value) => {
						this.selectedType = this.normalizeTypeFilter(value);
						this.renderList();
					});
			})
			.addButton((button) =>
				button
					.setButtonText(t("boardRefreshList"))
					.onClick(() => this.refreshList(true))
			);

		const visibleItems = this.getVisibleItems();
		if (visibleItems.length === 0) {
			contentEl.createDiv({
				cls: "bangumi-note-board-empty",
				text:
					this.items.length === 0
						? t("boardEmpty")
						: t("boardFilterEmpty")
			});
			return;
		}

		const listEl = contentEl.createDiv({ cls: "bangumi-note-board-list" });
		for (const item of visibleItems) {
			const button = listEl.createEl("button", {
				cls: "bangumi-note-board-item"
			});
			button.type = "button";
			const titleRow = button.createDiv({
				cls: "bangumi-note-board-item-title-row"
			});
			titleRow.createDiv({
				cls: "bangumi-note-board-item-title",
				text: item.title
			});
			this.renderTypeBadge(titleRow, item.type);
			button.addEventListener("click", () => {
				void this.openItem(item);
			});
		}
	}

	private async openItem(item: ProgressBoardItem): Promise<void> {
		if (!this.plugin.settings.accessToken) {
			new Notice(t("noToken"));
			return;
		}

		this.selectedItem = item;
		this.loading = true;
		this.renderDetail();

		try {
			await this.loadItemEpisodes(item);
		} catch (error) {
			const message = error instanceof Error ? error.message : t("unknownError");
			new Notice(t("boardLoadFailed", { message }));
			this.episodes = [];
			this.remoteStatus = null;
		} finally {
			this.loading = false;
			this.renderDetail();
		}
	}

	private getVisibleItems(): ProgressBoardItem[] {
		if (this.selectedType === "all") {
			return this.items;
		}
		return this.items.filter((item) => item.type === this.selectedType);
	}

	private getTypeFilterLabel(type: BoardTypeFilter): string {
		return type === "all" ? t("boardTypeAll") : type;
	}

	private normalizeTypeFilter(value: string): BoardTypeFilter {
		return BOARD_TYPE_FILTERS.includes(value as BoardTypeFilter)
			? (value as BoardTypeFilter)
			: "all";
	}

	private async loadItemEpisodes(item: ProgressBoardItem): Promise<void> {
		const client = this.plugin.getBangumiClient();
		const username =
			this.plugin.settings.username || (await client.getMe()).username;
		const [collection, episodeCollections] = await Promise.all([
			client.getSubjectCollection(item.subjectId, username),
			client.getAllSubjectEpisodeCollections(item.subjectId)
		]);

		this.remoteStatus = collection.type;
		this.remoteComment = collection.comment ?? "";
		this.remoteRating = collection.rate ?? 0;
		this.episodes = this.toBoardEpisodes(episodeCollections);
	}

	private renderDetail(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("bangumi-note-board");

		const item = this.selectedItem;
		if (!item) {
			this.renderList();
			return;
		}

		new Setting(contentEl)
			.setName(item.title)
			.addButton((button) =>
				button
					.setButtonText(t("boardBackToList"))
					.onClick(() => this.renderList())
			)
			.addButton((button) =>
				button
					.setButtonText(t("boardRefreshItem"))
					.onClick(() => {
						void this.openItem(item);
					})
			);

		if (this.loading) {
			contentEl.createDiv({
				cls: "bangumi-note-board-empty",
				text: t("boardLoading")
			});
			return;
		}

		new Setting(contentEl)
			.setName(t("boardStatus"))
			.addDropdown((dropdown) => {
				for (const option of BOARD_STATUS_OPTIONS) {
					dropdown.addOption(String(option.type), option.label);
				}
				dropdown
					.setValue(String(this.remoteStatus ?? BANGUMI_COLLECTION_TYPES.do))
					.onChange((value) => {
						void this.changeStatus(Number(value) as BangumiCollectionType);
					});
			});

		if (this.episodes.length === 0) {
			contentEl.createDiv({
				cls: "bangumi-note-board-empty",
				text: t("boardNoEpisodes")
			});
			return;
		}

		contentEl.createDiv({
			cls: "bangumi-note-board-progress",
			text: t("boardProgress", {
				done: this.countLocalDone(),
				total: this.episodes.length
			})
		});

		const gridEl = contentEl.createDiv({ cls: "bangumi-note-board-grid" });
		for (const episode of this.episodes) {
			const cell = gridEl.createEl("button", {
				cls: `bangumi-note-board-cell${episode.type === 0 ? "" : " is-extra"}${episode.localChecked ? " is-done" : ""}${episode.localChecked !== episode.remoteChecked ? " is-changed" : ""}`,
				text: this.renderEpisodeCellText(episode)
			});
			cell.type = "button";
			cell.title = this.renderEpisodeTitle(episode);
			cell.addEventListener("click", () => {
				episode.localChecked = !episode.localChecked;
				this.renderDetail();
			});
		}

		const summary = this.getChanges();
		contentEl.createDiv({
			cls: "bangumi-note-board-summary",
			text: t("boardChangeSummary", {
				done: summary.markDone.length,
				undone: summary.markUndone.length
			})
		});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(t("boardDiscardChanges"))
					.onClick(() => {
						for (const episode of this.episodes) {
							episode.localChecked = episode.remoteChecked;
						}
						this.renderDetail();
					})
			)
			.addButton((button) =>
				button
					.setButtonText(t("boardPushChanges"))
					.setCta()
					.setDisabled(!this.canPush() || this.getChangeCount() === 0)
					.onClick(() => {
						void this.pushChanges();
					})
			);

		if (!this.canPush()) {
			contentEl.createDiv({
				cls: "bangumi-note-board-warning",
				text: t("boardPushUnsupported")
			});
		}
	}

	private async pushChanges(): Promise<void> {
		if (!this.plugin.settings.enableWriteBack) {
			new Notice(t("pushWriteBackDisabled"));
			return;
		}

		const item = this.selectedItem;
		if (!item) {
			return;
		}

		const changes = this.getChanges();
		if (changes.markDone.length === 0 && changes.markUndone.length === 0) {
			new Notice(t("pushNoChanges"));
			return;
		}

		const confirmed = await this.confirmPush(changes);
		if (!confirmed) {
			new Notice(t("pushCancelled"));
			return;
		}

		try {
			const client = this.plugin.getBangumiClient();
			new Notice(t("pushStarted"));
			if (changes.markDone.length > 0) {
				await client.patchSubjectEpisodeCollections({
					subjectId: item.subjectId,
					episodeIds: changes.markDone.map((episode) => episode.id),
					type: 2
				});
			}
			if (changes.markUndone.length > 0) {
				await client.patchSubjectEpisodeCollections({
					subjectId: item.subjectId,
					episodeIds: changes.markUndone.map((episode) => episode.id),
					type: 0
				});
			}
			await this.reloadAndVerify(item, changes);
			await this.updateLocalEpisodeChecklist(item);
			this.updateListProgress(item);
			new Notice(
				t("boardPushFinished", {
					episodes: changes.markDone.length + changes.markUndone.length
				})
			);
			this.renderDetail();
		} catch (error) {
			const message = error instanceof Error ? error.message : t("unknownError");
			new Notice(t("pushFailed", { message }));
			console.error(error);
		}
	}

	private async changeStatus(nextType: BangumiCollectionType): Promise<void> {
		if (!this.plugin.settings.enableWriteBack) {
			new Notice(t("pushWriteBackDisabled"));
			this.renderDetail();
			return;
		}

		const item = this.selectedItem;
		if (!item || this.remoteStatus === null || nextType === this.remoteStatus) {
			this.renderDetail();
			return;
		}

		const collectionInfo = await this.promptStatusCollectionInfo(nextType);
		if (collectionInfo === null) {
			this.renderDetail();
			return;
		}

		try {
			const client = this.plugin.getBangumiClient();
			new Notice(t("boardStatusStarted"));
			await client.patchSubjectCollection({
				subjectId: item.subjectId,
				type: nextType,
				comment: collectionInfo.comment,
				rate: collectionInfo.rating
			});
			const username =
				this.plugin.settings.username || (await client.getMe()).username;
			const remote = await client.getSubjectCollection(item.subjectId, username);
			if (remote.type !== nextType) {
				throw new Error(
					t("pushStatusVerifyFailed", {
						expected: collectionStatusLabel(nextType),
						actual: collectionStatusLabel(remote.type)
					})
				);
			}

			this.remoteStatus = remote.type;
			this.remoteComment = remote.comment ?? collectionInfo.comment;
			this.remoteRating = remote.rate ?? collectionInfo.rating;
			await this.updateLocalStatus(
				item,
				remote.type,
				this.remoteComment,
				this.remoteRating
			);
			await this.moveLocalNote(item, remote.type);
			await this.refreshLocalSubjectNote({
				...remote,
				comment: this.remoteComment,
				rate: this.remoteRating
			});

			new Notice(
				t("boardStatusFinished", {
					status: collectionStatusLabel(remote.type)
				})
			);
			if (remote.type !== BANGUMI_COLLECTION_TYPES.do) {
				this.items = this.items.filter(
					(entry) => entry.subjectId !== item.subjectId
				);
				this.selectedItem = null;
				this.episodes = [];
				this.renderList();
			} else {
				item.status = "do";
				this.renderDetail();
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : t("unknownError");
			new Notice(t("pushFailed", { message }));
			console.error(error);
			this.renderDetail();
		}
	}

	private promptStatusCollectionInfo(
		nextType: BangumiCollectionType
	): Promise<{ comment: string; rating: number } | null> {
		const previousStatus =
			this.remoteStatus === null ? "" : collectionStatusLabel(this.remoteStatus);
		return new Promise((resolve) => {
			new BoardStatusCommentModal(
				this.app,
				previousStatus,
				collectionStatusLabel(nextType),
				this.remoteComment,
				this.remoteRating,
				resolve
			).open();
		});
	}

	private async updateLocalStatus(
		item: ProgressBoardItem,
		status: BangumiCollectionType,
		comment: string,
		rating: number
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(item.file, (frontmatter) => {
			const values = frontmatter as Record<string, unknown>;
			values.status = collectionStatusLabel(status);
			values.comment = comment;
			values.rating = rating;
		});
		item.status = collectionStatusLabel(status);
		item.rating = rating === 0 ? "" : String(rating);
	}

	private async refreshLocalSubjectNote(
		collection: BangumiCollection
	): Promise<void> {
		await new SyncService(
			this.app,
			this.plugin.settings,
			() => this.plugin.getBangumiClient()
		).syncSubjectCollection(collection);
	}

	private async updateLocalEpisodeChecklist(
		item: ProgressBoardItem
	): Promise<void> {
		const checkedByEpisodeId = new Map<number, boolean>(
			this.episodes.map((episode) => [episode.id, episode.remoteChecked])
		);
		const content = await this.app.vault.read(item.file);
		const nextContent = updateEpisodeChecklistContent(
			content,
			checkedByEpisodeId
		);
		if (nextContent !== content) {
			await this.app.vault.modify(item.file, nextContent);
		}
		await this.app.fileManager.processFrontMatter(item.file, (frontmatter) => {
			const values = frontmatter as Record<string, unknown>;
			values.progress_done = this.countLocalDone();
		});
		this.plugin.invalidateProgressBoardCache();
	}

	private async moveLocalNote(
		item: ProgressBoardItem,
		status: BangumiCollectionType
	): Promise<void> {
		if (this.plugin.settings.storageLayout === BANGUMI_STORAGE_LAYOUTS.flat) {
			return;
		}

		const targetDirectory = normalizePath(
			this.getTargetDirectory(item.type, collectionStatusLabel(status))
		);
		await this.ensureFolder(targetDirectory);
		const fileName = item.file.path.split("/").pop() ?? item.file.name;
		const targetPath = normalizePath(`${targetDirectory}/${fileName}`);
		if (normalizePath(item.file.path) === targetPath) {
			return;
		}
		const existing = this.app.vault.getAbstractFileByPath(targetPath);
		if (existing) {
			throw new Error(t("pushMoveTargetExists", { path: targetPath }));
		}
		await this.app.vault.rename(item.file, targetPath);
		item.path = targetPath;
		this.plugin.invalidateProgressBoardCache();
	}

	private getTargetDirectory(type: string, status: string): string {
		const root = this.plugin.settings.syncDirectory;
		switch (this.plugin.settings.storageLayout) {
			case BANGUMI_STORAGE_LAYOUTS.subjectThenCollection:
				return `${root}/${type}/${status}`;
			case BANGUMI_STORAGE_LAYOUTS.collectionThenSubject:
				return `${root}/${status}/${type}`;
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

	private async reloadAndVerify(
		item: ProgressBoardItem,
		changes: { markDone: BoardEpisode[]; markUndone: BoardEpisode[] }
	): Promise<void> {
		const client = this.plugin.getBangumiClient();
		const episodeCollections = await client.getAllSubjectEpisodeCollections(
			item.subjectId
		);
		const nextEpisodes = this.toBoardEpisodes(episodeCollections);
		const remoteMap = new Map<number, boolean>(
			nextEpisodes.map((episode) => [episode.id, episode.remoteChecked])
		);

		const failedIds: number[] = [];
		for (const episode of changes.markDone) {
			if (remoteMap.get(episode.id) !== true) failedIds.push(episode.id);
		}
		for (const episode of changes.markUndone) {
			if (remoteMap.get(episode.id) !== false) failedIds.push(episode.id);
		}
		if (failedIds.length > 0) {
			throw new Error(t("pushEpisodeVerifyFailed", { ids: failedIds.join(", ") }));
		}

		this.episodes = nextEpisodes;
	}

	private updateListProgress(item: ProgressBoardItem): void {
		const current = this.items.find((entry) => entry.subjectId === item.subjectId);
		if (current) {
			current.progressDone = this.countLocalDone();
			current.epsTotal = this.episodes.length;
		}
		item.progressDone = this.countLocalDone();
		item.epsTotal = this.episodes.length;
	}

	private toBoardEpisodes(
		episodeCollections: BangumiEpisodeCollection[]
	): BoardEpisode[] {
		return episodeCollections
			.filter((item) => item.episode !== null)
			.sort((left, right) => {
				const leftEpisode = left.episode!;
				const rightEpisode = right.episode!;
				return compareEpisodesByTypeThenSort(leftEpisode, rightEpisode);
			})
			.map((item) => {
				const episode = item.episode!;
				const checked = item.type > 0;
				return {
					id: episode.id,
					type: episode.type,
					sort: episode.sort,
					title: episode.name_cn || episode.name || "",
					airdate: episode.airdate ?? "",
					remoteChecked: checked,
					localChecked: checked
				};
			});
	}

	private getChanges(): { markDone: BoardEpisode[]; markUndone: BoardEpisode[] } {
		return {
			markDone: this.episodes.filter(
				(episode) => episode.localChecked && !episode.remoteChecked
			),
			markUndone: this.episodes.filter(
				(episode) => !episode.localChecked && episode.remoteChecked
			)
		};
	}

	private getChangeCount(): number {
		const changes = this.getChanges();
		return changes.markDone.length + changes.markUndone.length;
	}

	private canPush(): boolean {
		return (
			this.remoteStatus === BANGUMI_COLLECTION_TYPES.do ||
			this.remoteStatus === BANGUMI_COLLECTION_TYPES.collect
		);
	}

	private countLocalDone(): number {
		return this.episodes.filter((episode) => episode.localChecked).length;
	}

	private renderTypeBadge(parent: HTMLElement, type: string): void {
		const label = type || "unknown";
		parent.createSpan({
			cls: `bangumi-note-board-type-badge is-${this.toBadgeClass(label)}`,
			text: label
		});
	}

	private toBadgeClass(value: string): string {
		return value.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
	}

	private renderEpisodeTitle(episode: BoardEpisode): string {
		return [
			this.renderEpisodeCellText(episode),
			episode.title,
			episode.airdate,
			`bgm-ep:${episode.id}`
		]
			.filter(Boolean)
			.join(" · ");
	}

	private renderEpisodeCellText(episode: BoardEpisode): string {
		return `${episodeTypeLabel(episode.type)}${episode.sort}`;
	}

	private confirmPush(changes: {
		markDone: BoardEpisode[];
		markUndone: BoardEpisode[];
	}): Promise<boolean> {
		return new Promise((resolve) => {
			new BoardPushConfirmModal(this.app, changes, resolve).open();
		});
	}
}

export function updateEpisodeChecklistContent(
	content: string,
	checkedByEpisodeId: Map<number, boolean>
): string {
	const start = content.indexOf(SYNC_BLOCK_START);
	const end = content.indexOf(SYNC_BLOCK_END);
	if (start === -1 || end === -1 || end < start) {
		return content;
	}

	const blockEnd = end + SYNC_BLOCK_END.length;
	const before = content.slice(0, start);
	const block = content.slice(start, blockEnd);
	const after = content.slice(blockEnd);
	const nextBlock = block.replace(
		/^(\s*-\s+\[)([ xX])(\]\s+.*?<!--\s*bgm-ep:(\d+)(?:\s|>).*?-->)$/gm,
		(match, prefix: string, _checked: string, suffix: string, id: string) => {
			const checked = checkedByEpisodeId.get(Number(id));
			return checked === undefined
				? match
				: `${prefix}${checked ? "x" : " "}${suffix}`;
		}
	);

	return `${before}${nextBlock}${after}`;
}

class BoardPushConfirmModal extends Modal {
	private resolved = false;

	constructor(
		app: App,
		private readonly changes: {
			markDone: BoardEpisode[];
			markUndone: BoardEpisode[];
		},
		private readonly resolve: (confirmed: boolean) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		new Setting(contentEl).setName(t("pushConfirmTitle")).setHeading();
		contentEl.createEl("p", { text: t("pushConfirmDesc") });

		const lines = [
			`Mark done: ${this.changes.markDone.length}`,
			...this.changes.markDone.map(
				(episode) => `  - EP${episode.sort} ${episode.title} (bgm-ep:${episode.id})`
			),
			`Mark undone: ${this.changes.markUndone.length}`,
			...this.changes.markUndone.map(
				(episode) => `  - EP${episode.sort} ${episode.title} (bgm-ep:${episode.id})`
			)
		];
		const previewEl = contentEl.createEl("pre", { text: lines.join("\n") });
		previewEl.addClass("bangumi-note-push-preview");

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(t("pushCancel"))
					.onClick(() => {
						this.finish(false);
						this.close();
					})
			)
			.addButton((button) =>
				button
					.setButtonText(t("pushConfirm"))
					.setCta()
					.onClick(() => {
						this.finish(true);
						this.close();
					})
			);
	}

	onClose(): void {
		this.finish(false);
		this.contentEl.empty();
	}

	private finish(confirmed: boolean): void {
		if (this.resolved) return;
		this.resolved = true;
		this.resolve(confirmed);
	}
}

class BoardStatusCommentModal extends Modal {
	private resolved = false;
	private textarea: HTMLTextAreaElement | null = null;
	private previewEl: HTMLPreElement | null = null;
	private rating = 0;

	constructor(
		app: App,
		private readonly previousStatus: string,
		private readonly nextStatus: string,
		private readonly initialComment: string,
		private readonly initialRating: number,
		private readonly resolve: (
			info: { comment: string; rating: number } | null
		) => void
	) {
		super(app);
		this.rating = initialRating;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		new Setting(contentEl)
			.setName(t("boardStatusCommentTitle", { status: this.nextStatus }))
			.setHeading();
		contentEl.createEl("p", { text: t("boardStatusCommentDesc") });
		new Setting(contentEl)
			.setName(t("boardRating"))
			.addDropdown((dropdown) => {
				dropdown.addOption("0", t("boardRatingNone"));
				for (let rating = 1; rating <= 10; rating++) {
					dropdown.addOption(String(rating), String(rating));
				}
				dropdown
					.setValue(String(this.rating))
					.onChange((value) => {
						this.rating = Number(value);
						this.renderPreview();
					});
			});
		this.textarea = contentEl.createEl("textarea");
		this.textarea.value = this.initialComment;
		this.textarea.addClass("bangumi-note-board-comment-textarea");
		this.textarea.addEventListener("input", () => this.renderPreview());

		this.previewEl = contentEl.createEl("pre");
		this.previewEl.addClass("bangumi-note-push-preview");
		this.renderPreview();

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(t("pushCancel"))
					.onClick(() => {
						this.finish(null);
						this.close();
					})
			)
			.addButton((button) =>
				button
					.setButtonText(t("pushConfirm"))
					.setCta()
					.onClick(() => {
						this.finish({
							comment: this.textarea?.value ?? "",
							rating: this.rating
						});
						this.close();
					})
			);
	}

	onClose(): void {
		this.finish(null);
		this.contentEl.empty();
	}

	private renderPreview(): void {
		if (!this.previewEl) return;
		const comment = this.textarea?.value ?? this.initialComment;
		const empty = t("boardEmptyValue");
		this.previewEl.setText(
			[
				`${t("boardStatus")}: ${this.previousStatus} -> ${this.nextStatus}`,
				`${t("boardRating")}: ${this.formatRating(this.initialRating)} -> ${this.formatRating(this.rating)}`,
				`${t("boardComment")}:`,
				`  ${this.initialComment || empty}`,
				"  ->",
				`  ${comment || empty}`
			].join("\n")
		);
	}

	private formatRating(rating: number): string {
		return rating === 0 ? t("boardRatingNone") : String(rating);
	}

	private finish(info: { comment: string; rating: number } | null): void {
		if (this.resolved) return;
		this.resolved = true;
		this.resolve(info);
	}
}
