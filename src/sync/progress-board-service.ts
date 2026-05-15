import { App, TFile, normalizePath } from "obsidian";

export interface ProgressBoardItem {
	file: TFile;
	path: string;
	subjectId: number;
	title: string;
	type: string;
	status: string;
	progressDone: number | null;
	epsTotal: number | null;
	rating: string;
}

export class ProgressBoardService {
	constructor(
		private readonly app: App,
		private readonly syncDirectory: string
	) {}

	listDoingItems(): ProgressBoardItem[] {
		const directory = normalizePath(this.syncDirectory || "Bangumi");
		const items: ProgressBoardItem[] = [];

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!this.isInsideDirectory(file, directory)) {
				continue;
			}

			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (typeof frontmatter !== "object" || frontmatter === null) {
				continue;
			}

			const values = frontmatter as Record<string, unknown>;
			if (values.status !== "do") {
				continue;
			}

			const subjectId = Number(values.bangumi_id);
			if (!Number.isInteger(subjectId) || subjectId <= 0) {
				continue;
			}

			items.push({
				file,
				path: file.path,
				subjectId,
				title: this.readString(values.title) || file.basename,
				type: this.readString(values.type),
				status: "do",
				progressDone: this.readNumber(values.progress_done),
				epsTotal: this.readNumber(values.eps_total),
				rating: this.readString(values.rating)
			});
		}

		return items.sort((left, right) => left.title.localeCompare(right.title));
	}

	private isInsideDirectory(file: TFile, directory: string): boolean {
		return file.path.startsWith(`${directory}/`) || file.parent?.path === directory;
	}

	private readString(value: unknown): string {
		if (typeof value === "string") {
			return value;
		}
		if (typeof value === "number") {
			return String(value);
		}
		return "";
	}

	private readNumber(value: unknown): number | null {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
}
