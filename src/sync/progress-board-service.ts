import { App, TFile, normalizePath } from "obsidian";
import { getMarkdownFilesInFolder } from "../utils/vault";

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

		for (const file of getMarkdownFilesInFolder(this.app, directory)) {
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

export class ProgressBoardCache {
	private cachedDirectory = "";
	private cachedItems: ProgressBoardItem[] | null = null;

	constructor(private readonly app: App) {}

	listDoingItems(syncDirectory: string, forceRefresh = false): ProgressBoardItem[] {
		const directory = normalizePath(syncDirectory || "Bangumi");
		if (
			!forceRefresh &&
			this.cachedItems !== null &&
			this.cachedDirectory === directory
		) {
			return this.cachedItems;
		}

		this.cachedDirectory = directory;
		this.cachedItems = new ProgressBoardService(
			this.app,
			directory
		).listDoingItems();
		return this.cachedItems;
	}

	invalidate(): void {
		this.cachedItems = null;
	}
}
