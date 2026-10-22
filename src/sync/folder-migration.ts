import { App, TFile, TFolder, normalizePath } from "obsidian";

import { BANGUMI_STORAGE_LAYOUTS, BangumiSyncSettings } from "../settings";
import {
	FOLDER_NAMINGS,
	FolderNaming,
	STATUS_FOLDER_KEYS,
	SUBJECT_FOLDER_KEYS
} from "../utils/folder-naming";
import { buildTargetDirectory } from "../utils/target-directory";
import { ensureFolder } from "../utils/vault";

export interface FolderMove {
	from: string;
	to: string;
}

export interface FolderMigrationPlan {
	fromNaming: FolderNaming;
	toNaming: FolderNaming;
	/** Notes that will be moved to the target naming. */
	moves: FolderMove[];
	/** Notes skipped because the target path is already taken. */
	conflicts: FolderMove[];
	/** Source folders that become empty once the moves are done. */
	sourceFolders: string[];
}

export interface FolderMigrationResult {
	moved: number;
	conflicts: number;
	removedFolders: number;
}

function parentOf(path: string): string | null {
	const index = path.lastIndexOf("/");
	return index > 0 ? path.slice(0, index) : null;
}

/**
 * Rename the classification folders from one naming to the other.
 *
 * The vault index is used on purpose: a migration is an explicit user action on
 * a fully loaded vault, and going through `vault.rename` keeps Obsidian's link
 * graph consistent.
 *
 * Every path is computed through buildTargetDirectory, so this stays in sync
 * with the sync service and the progress board.
 */
export class FolderMigration {
	constructor(
		private readonly app: App,
		private readonly settings: BangumiSyncSettings
	) {}

	buildPlan(): FolderMigrationPlan {
		const toNaming = this.settings.folderNaming;
		const fromNaming: FolderNaming =
			toNaming === FOLDER_NAMINGS.chinese
				? FOLDER_NAMINGS.english
				: FOLDER_NAMINGS.chinese;

		const plan: FolderMigrationPlan = {
			fromNaming,
			toNaming,
			moves: [],
			conflicts: [],
			sourceFolders: []
		};

		if (this.settings.storageLayout === BANGUMI_STORAGE_LAYOUTS.flat) {
			return plan;
		}

		const root = this.settings.syncDirectory;
		const sourceFolders = new Set<string>();

		for (const subject of SUBJECT_FOLDER_KEYS) {
			for (const status of STATUS_FOLDER_KEYS) {
				const from = normalizePath(
					buildTargetDirectory(
						{ root, layout: this.settings.storageLayout, naming: fromNaming },
						subject,
						status
					)
				);
				const to = normalizePath(
					buildTargetDirectory(
						{ root, layout: this.settings.storageLayout, naming: toNaming },
						subject,
						status
					)
				);
				if (from === to) continue;

				const folder = this.app.vault.getAbstractFileByPath(from);
				if (!(folder instanceof TFolder)) continue;
				sourceFolders.add(from);

				for (const child of folder.children) {
					if (!(child instanceof TFile) || child.extension !== "md") continue;
					const targetPath = normalizePath(`${to}/${child.name}`);
					const move: FolderMove = { from: child.path, to: targetPath };
					if (this.app.vault.getAbstractFileByPath(targetPath)) {
						plan.conflicts.push(move);
					} else {
						plan.moves.push(move);
					}
				}
			}
		}

		plan.sourceFolders = [...sourceFolders];
		return plan;
	}

	async execute(plan: FolderMigrationPlan): Promise<FolderMigrationResult> {
		let moved = 0;

		for (const move of plan.moves) {
			const file = this.app.vault.getAbstractFileByPath(move.from);
			if (!(file instanceof TFile)) continue;
			const directory = parentOf(move.to);
			if (directory) {
				await ensureFolder(this.app, directory);
			}
			await this.app.vault.rename(file, move.to);
			moved += 1;
		}

		const removedFolders = await this.removeEmptyFolders(plan.sourceFolders);

		return {
			moved,
			conflicts: plan.conflicts.length,
			removedFolders
		};
	}

	/**
	 * Delete the now-empty source folders, deepest first, then walk upwards so
	 * an emptied status folder (collection-then-subject) also disappears.
	 */
	private async removeEmptyFolders(folders: string[]): Promise<number> {
		const candidates = new Set<string>();
		for (const folder of folders) {
			let current: string | null = folder;
			while (current) {
				candidates.add(current);
				current = parentOf(current);
			}
		}

		const root = normalizePath(this.settings.syncDirectory);
		const ordered = [...candidates]
			.filter((path) => path !== root && path.length > root.length)
			.sort((a, b) => b.split("/").length - a.split("/").length);

		let removed = 0;
		let changed = true;
		while (changed) {
			changed = false;
			for (const path of ordered) {
				const folder = this.app.vault.getAbstractFileByPath(path);
				if (folder instanceof TFolder && folder.children.length === 0) {
					await this.app.fileManager.trashFile(folder);
					removed += 1;
					changed = true;
				}
			}
		}
		return removed;
	}
}
