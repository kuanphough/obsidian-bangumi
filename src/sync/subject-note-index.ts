import { App, TFile, normalizePath } from "obsidian";

export class SubjectNoteIndex {
	private readonly byId = new Map<number, TFile>();

	private constructor() {}

	static build(app: App, syncDirectory: string): SubjectNoteIndex {
		const directory = normalizePath(syncDirectory);
		const index = new SubjectNoteIndex();
		for (const file of app.vault.getMarkdownFiles()) {
			if (
				!file.path.startsWith(`${directory}/`) &&
				file.parent?.path !== directory
			) {
				continue;
			}
			const id = readSubjectId(app, file);
			if (id !== null) {
				index.byId.set(id, file);
			}
		}
		return index;
	}

	get(subjectId: number): TFile | null {
		return this.byId.get(subjectId) ?? null;
	}

	has(subjectId: number): boolean {
		return this.byId.has(subjectId);
	}

	add(subjectId: number, file: TFile): void {
		this.byId.set(subjectId, file);
	}

	ids(): Set<number> {
		return new Set(this.byId.keys());
	}

	toMap(): Map<number, TFile> {
		return new Map(this.byId);
	}
}

function readSubjectId(app: App, file: TFile): number | null {
	const frontmatter: unknown =
		app.metadataCache.getFileCache(file)?.frontmatter;
	if (typeof frontmatter === "object" && frontmatter !== null) {
		const raw = (frontmatter as { bangumi_id?: unknown }).bangumi_id;
		const parsed = Number(raw);
		if (Number.isInteger(parsed)) {
			return parsed;
		}
	}

	const match = file.basename.match(/bgm-(\d+)/);
	if (match) {
		return Number(match[1]);
	}

	return null;
}
