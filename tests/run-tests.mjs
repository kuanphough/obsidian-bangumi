import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const obsidianMock = `
export class TFile {
	constructor(path) {
		this.path = path;
		this.basename = path.split("/").pop().replace(/\\.md$/, "");
		const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
		this.parent = { path: parentPath };
	}
}
export class Notice {
	constructor(message) {
		Notice.messages.push(message);
	}
}
Notice.messages = [];
export class Plugin {
	constructor() {
		this.app = {};
		this.manifest = { version: "0.1.1" };
	}
	async loadData() {
		return this.__data ?? {};
	}
	async saveData(data) {
		this.__saved = data;
	}
	addRibbonIcon() {}
	addCommand() {}
	addSettingTab() {}
}
export class PluginSettingTab {}
export class Setting {}
export function normalizePath(path) {
	return path.replace(/\\\\/g, "/").replace(/\\/+/g, "/").replace(/\\/$/, "");
}
export function getLanguage() {
	return "en";
}
export const moment = () => ({ format: () => "2026-05-14" });
export async function requestUrl() {
	return { status: 200, text: "", json: {} };
}
`;

const entry = `
import assert from "node:assert/strict";
import { TFile } from "obsidian";
import BangumiSyncPlugin from "./src/main.ts";
import { BANGUMI_COLLECTION_TYPES, BANGUMI_SUBJECT_TYPES } from "./src/bangumi/types.ts";
import { DEFAULT_SETTINGS, BANGUMI_FILE_NAME_FORMATS } from "./src/settings.ts";
import {
	DEFAULT_SUBJECT_NOTE_TEMPLATE,
	LEGACY_DEFAULT_SUBJECT_NOTE_TEMPLATE,
	MarkdownRenderer
} from "./src/sync/markdown-renderer.ts";
import { NoteWriter } from "./src/sync/note-writer.ts";
import { SyncService } from "./src/sync/sync-service.ts";

function makeSubject(overrides = {}) {
	return {
		collection: {
			type: BANGUMI_COLLECTION_TYPES.do,
			rate: 8,
			comment: "nice",
			tags: ["tv"],
			updated_at: "2026-05-14T08:00:00+08:00",
			subject: {
				id: 123,
				type: BANGUMI_SUBJECT_TYPES.anime,
				name: "Original",
				name_cn: "中文标题",
				eps: 2,
				date: "2026-01-01",
				images: { large: "https://example.com/cover.jpg" }
			}
		},
		episodes: [
			{ type: 2, episode: { id: 1, type: 0, sort: 1, name: "One" } },
			{ type: 0, episode: { id: 2, type: 0, sort: 2, name: "Two" } }
		],
		...overrides
	};
}

function makeApp(files = [], contents = new Map(), frontmatter = new Map()) {
	const created = [];
	const modified = [];
	const app = {
		vault: {
			getMarkdownFiles: () => files,
			getAbstractFileByPath: (path) => files.find((file) => file.path === path) ?? null,
			read: async (file) => contents.get(file.path) ?? "",
			modify: async (file, content) => {
				modified.push({ file, content });
				contents.set(file.path, content);
			},
			create: async (path, content) => {
				const file = new TFile(path);
				files.push(file);
				contents.set(path, content);
				created.push({ file, content });
				return file;
			},
			createFolder: async () => {}
		},
		metadataCache: {
			getFileCache: (file) => ({ frontmatter: frontmatter.get(file.path) ?? {} })
		},
		workspace: {
			getLeaf: () => ({ openFile: async () => {} })
		}
	};
	return { app, files, contents, frontmatter, created, modified };
}

{
	const rendered = new MarkdownRenderer().renderSubjectNote(makeSubject());
	assert.match(rendered, /progress_done: 1/);
	assert.doesNotMatch(rendered, /progress_total:/);
	assert.doesNotMatch(rendered, /progress_percent:/);
	assert.doesNotMatch(rendered, /progress_available:/);
	assert.doesNotMatch(rendered, /next_episode:/);
	assert.doesNotMatch(rendered, /last_done_episode:/);
	assert.doesNotMatch(rendered, /air_date:/);
}

{
	const renderer = new MarkdownRenderer();
	const next = renderer.renderSubjectNote(makeSubject());
	const existing = \`---
bangumi_id: 123
old: true
---

# 中文标题

<!-- bangumi-sync-start -->
old generated content
<!-- bangumi-sync-end -->

## Notes
handwritten\`;
	const merged = renderer.mergeSyncedContent(existing, next);
	assert.match(merged, /progress_done: 1/);
	assert.doesNotMatch(merged, /old: true/);
	assert.match(merged, /## Notes\\nhandwritten/);
	assert.match(merged, /EP1 One/);
}

{
	const renderer = new MarkdownRenderer();
	const subject = makeSubject();
	const existingContent = renderer.renderSubjectNote(subject);
	const file = new TFile("Bangumi/中文标题 [bgm-123].md");
	const { app, contents, frontmatter, modified } = makeApp([file]);
	contents.set(file.path, existingContent);
	frontmatter.set(file.path, { bangumi_id: 123 });
	const writer = new NoteWriter(app, renderer, BANGUMI_FILE_NAME_FORMATS.titleThenId);
	const result = await writer.writeSubjectNote("Bangumi", "Bangumi", subject);
	assert.equal(result.changed, false);
	assert.equal(modified.length, 0);
}

{
	const fileByFrontmatter = new TFile("Bangumi/anime/do/Any.md");
	const fileByName = new TFile("Bangumi/game/do/Game [bgm-456].md");
	const { app, frontmatter } = makeApp([fileByFrontmatter, fileByName]);
	frontmatter.set(fileByFrontmatter.path, { bangumi_id: 123 });
	const service = new SyncService(app, { ...DEFAULT_SETTINGS, syncDirectory: "Bangumi" });
	const ids = service.getExistingSubjectIds();
	assert.deepEqual([...ids].sort((a, b) => a - b), [123, 456]);
	const unchanged = {
		...makeSubject().collection,
		updated_at: "2024-01-01T00:00:00+08:00"
	};
	service.settings.lastSyncedAt = "2026-01-01T00:00:00+08:00";
	assert.equal(service.shouldSkipUnchanged(unchanged), true);
	assert.equal(!service.shouldSkipUnchanged(unchanged) || !ids.has(789), true);
}

{
	const plugin = new BangumiSyncPlugin();
	plugin.__data = { subjectNoteTemplate: LEGACY_DEFAULT_SUBJECT_NOTE_TEMPLATE };
	await plugin.loadSettings();
	assert.equal(plugin.settings.subjectNoteTemplate, DEFAULT_SUBJECT_NOTE_TEMPLATE);
	assert.equal(plugin.__saved.subjectNoteTemplate, DEFAULT_SUBJECT_NOTE_TEMPLATE);

	const custom = LEGACY_DEFAULT_SUBJECT_NOTE_TEMPLATE + "\\ncustom";
	const pluginWithCustom = new BangumiSyncPlugin();
	pluginWithCustom.__data = { subjectNoteTemplate: custom };
	await pluginWithCustom.loadSettings();
	assert.equal(pluginWithCustom.settings.subjectNoteTemplate, custom);
}
`;

const result = await esbuild.build({
	stdin: {
		contents: entry,
		resolveDir: process.cwd(),
		sourcefile: "tests-inline.ts",
		loader: "ts"
	},
	bundle: true,
	format: "esm",
	platform: "node",
	write: false,
	plugins: [
		{
			name: "obsidian-mock",
			setup(build) {
				build.onResolve({ filter: /^obsidian$/ }, () => ({
					path: "obsidian",
					namespace: "obsidian-mock"
				}));
				build.onLoad({ filter: /.*/, namespace: "obsidian-mock" }, () => ({
					contents: obsidianMock,
					loader: "js"
				}));
			}
		}
	]
});

const code = result.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
await import(moduleUrl);
assert.ok(pathToFileURL(process.cwd()).href);
console.log("All tests passed.");
