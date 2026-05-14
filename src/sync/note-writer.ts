import { App, TFile, normalizePath } from "obsidian";

import { BangumiSyncedSubject } from "../bangumi/types";
import {
	BANGUMI_FILE_NAME_FORMATS,
	BangumiFileNameFormat
} from "../settings";
import { MarkdownRenderer } from "./markdown-renderer";

export interface NoteWriteResult {
	file: TFile;
	changed: boolean;
}

export class NoteWriter {
	constructor(
		private readonly app: App,
		private readonly renderer: MarkdownRenderer,
		private readonly fileNameFormat: BangumiFileNameFormat
	) {}

	async writeSubjectNote(
		syncRootDirectory: string,
		targetDirectory: string,
		subject: BangumiSyncedSubject
	): Promise<NoteWriteResult> {
		const existing = this.findExistingSubjectNote(
			subject.collection.subject.id,
			syncRootDirectory
		);
		const rendered = this.renderer.renderSubjectNote(subject);

		if (existing) {
			const previous = await this.app.vault.read(existing);
			const next = this.renderer.mergeSyncedContent(previous, rendered);
			if (next === previous) {
				return { file: existing, changed: false };
			}
			await this.app.vault.modify(existing, next);
			return { file: existing, changed: true };
		}

		const directory = normalizePath(targetDirectory);
		await this.ensureFolder(directory);

		const title =
			subject.collection.subject.name_cn || subject.collection.subject.name;
		const path = normalizePath(
			`${directory}/${this.buildFileName(title, subject.collection.subject.id)}.md`
		);
		const existingAtPath = this.app.vault.getAbstractFileByPath(path);
		if (existingAtPath instanceof TFile) {
			const previous = await this.app.vault.read(existingAtPath);
			const next = this.renderer.mergeSyncedContent(previous, rendered);
			if (next === previous) {
				return { file: existingAtPath, changed: false };
			}
			await this.app.vault.modify(existingAtPath, next);
			return { file: existingAtPath, changed: true };
		}

		const file = await this.app.vault.create(path, rendered);
		return { file, changed: true };
	}

	private findExistingSubjectNote(
		subjectId: number,
		syncDirectory: string
	): TFile | null {
		const directory = normalizePath(syncDirectory);
		const idMarker = `[bgm-${subjectId}]`;

		return (
			this.app.vault
				.getMarkdownFiles()
				.find(
					(file) =>
						file.path.startsWith(`${directory}/`) &&
						String(
							this.app.metadataCache.getFileCache(file)?.frontmatter?.bangumi_id
						) === String(subjectId)
				) ??
			this.app.vault
				.getMarkdownFiles()
				.find(
					(file) =>
						file.path.startsWith(`${directory}/`) &&
						(file.basename.includes(idMarker) ||
							file.basename.includes(String(subjectId)))
				) ??
			null
		);
	}

	private async ensureFolder(path: string): Promise<void> {
		const parts = path.split("/");
		let current = "";

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}

	private toSafeFileName(value: string): string {
		return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "Untitled";
	}

	private buildFileName(title: string, subjectId: number): string {
		const safeTitle = this.toSafeFileName(title);
		const id = `bgm-${subjectId}`;

		switch (this.fileNameFormat) {
			case BANGUMI_FILE_NAME_FORMATS.idThenTitle:
				return `${id} ${safeTitle}`;
			case BANGUMI_FILE_NAME_FORMATS.idOnly:
				return id;
			case BANGUMI_FILE_NAME_FORMATS.titleThenId:
			default:
				return `${safeTitle} [${id}]`;
		}
	}
}
