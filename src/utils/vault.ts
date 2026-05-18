import { App, TFile, TFolder, normalizePath } from "obsidian";

export async function ensureFolder(app: App, path: string): Promise<void> {
	const parts = normalizePath(path).split("/").filter(Boolean);
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			await app.vault.createFolder(current);
		}
	}
}

export function getMarkdownFilesInFolder(app: App, path: string): TFile[] {
	const root = app.vault.getAbstractFileByPath(normalizePath(path));
	if (root instanceof TFile) {
		return root.extension === "md" ? [root] : [];
	}
	if (!(root instanceof TFolder)) {
		return [];
	}

	const files: TFile[] = [];
	collectMarkdownFiles(root, files);
	return files;
}

function collectMarkdownFiles(folder: TFolder, files: TFile[]): void {
	for (const child of folder.children) {
		if (child instanceof TFile) {
			if (child.extension === "md") {
				files.push(child);
			}
			continue;
		}
		if (child instanceof TFolder) {
			collectMarkdownFiles(child, files);
		}
	}
}
