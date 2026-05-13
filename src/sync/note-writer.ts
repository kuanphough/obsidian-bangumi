import { App, TFile, normalizePath } from "obsidian";

import { BangumiSyncedSubject } from "../bangumi/types";
import { MarkdownRenderer } from "./markdown-renderer";

export class NoteWriter {
	constructor(
		private readonly app: App,
		private readonly renderer: MarkdownRenderer
	) {}

	async writeSubjectNote(
		syncDirectory: string,
		subject: BangumiSyncedSubject
	): Promise<TFile> {
		const existing = this.findExistingSubjectNote(
			subject.collection.subject.id,
			syncDirectory
		);
		const rendered = this.renderer.renderSubjectNote(subject);

		if (existing) {
			const previous = await this.app.vault.read(existing);
			await this.app.vault.modify(
				existing,
				this.renderer.mergeSyncedBlock(previous, rendered)
			);
			return existing;
		}

		const directory = normalizePath(syncDirectory);
		await this.ensureFolder(directory);

		const title =
			subject.collection.subject.name_cn || subject.collection.subject.name;
		const path = normalizePath(`${directory}/${this.toSafeFileName(title)}.md`);
		return this.app.vault.create(path, rendered);
	}

	private findExistingSubjectNote(
		subjectId: number,
		syncDirectory: string
	): TFile | null {
		const directory = normalizePath(syncDirectory);
		const marker = `bangumi_id: ${subjectId}`;

		return (
			this.app.vault
				.getMarkdownFiles()
				.find(
					(file) =>
						file.path.startsWith(`${directory}/`) &&
						this.app.metadataCache.getFileCache(file)?.frontmatter
							?.bangumi_id === subjectId
				) ??
			this.app.vault
				.getMarkdownFiles()
				.find((file) => file.path.startsWith(`${directory}/`) && file.basename.includes(String(subjectId))) ??
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
}
