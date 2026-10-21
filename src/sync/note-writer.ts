import { App, TFile, normalizePath } from "obsidian";

import { BangumiSyncedSubject } from "../bangumi/types";
import {
	BANGUMI_FILE_NAME_FORMATS,
	BangumiFileNameFormat
} from "../settings";
import { MarkdownRenderer } from "./markdown-renderer";
import { SubjectNoteIndex } from "./subject-note-index";

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
		targetDirectory: string,
		subject: BangumiSyncedSubject,
		index: SubjectNoteIndex
	): Promise<NoteWriteResult> {
		const subjectId = subject.collection.subject.id;
		const existing = index.get(subjectId);
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
			`${directory}/${this.buildFileName(title, subjectId)}.md`
		);
		const existingAtPath = this.app.vault.getAbstractFileByPath(path);
		if (existingAtPath instanceof TFile) {
			const previous = await this.app.vault.read(existingAtPath);
			const next = this.renderer.mergeSyncedContent(previous, rendered);
			index.add(subjectId, existingAtPath);
			if (next === previous) {
				return { file: existingAtPath, changed: false };
			}
			await this.app.vault.modify(existingAtPath, next);
			return { file: existingAtPath, changed: true };
		}

		// The vault index can lag behind the filesystem (most often right after
		// Obsidian starts), so create() can fail on a note that is already there.
		// Fall back to the raw adapter, which talks to the filesystem directly.
		try {
			const file = await this.app.vault.create(path, rendered);
			index.add(subjectId, file);
			return { file, changed: true };
		} catch (error) {
			const adopted = await this.adoptExistingNote(
				path,
				rendered,
				subjectId,
				index
			);
			if (adopted) return adopted;
			throw error;
		}
	}

	/**
	 * Handle a note that exists on disk but is not visible to the vault index yet.
	 * Returns null when the file genuinely does not exist, so the caller can
	 * surface the original error.
	 */
	private async adoptExistingNote(
		path: string,
		rendered: string,
		subjectId: number,
		index: SubjectNoteIndex
	): Promise<NoteWriteResult | null> {
		const vault = this.app.vault;
		if (!(await vault.adapter.exists(path))) {
			return null;
		}

		const previous = await vault.adapter.read(path);
		const next = this.renderer.mergeSyncedContent(previous, rendered);
		if (next !== previous) {
			await vault.adapter.write(path, next);
		}

		// Call through the vault instance: these methods rely on `this`.
		const file = vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			index.add(subjectId, file);
			return { file, changed: next !== previous };
		}

		// Content is already on disk; the vault will pick it up once indexing
		// finishes, and the next sync will treat it as an existing note.
		return null;
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
