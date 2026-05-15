import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const obsidianMock = `
export class TFile {
	constructor(path) {
		this.path = path;
		this.basename = path.split("/").pop().replace(/\\.md$/, "");
		this.extension = path.split(".").pop();
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
		this.manifest = { version: "0.1.3" };
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
	registerView() {}
}
export class PluginSettingTab {}
export class Setting {}
export class ItemView {
	constructor(leaf) {
		this.leaf = leaf;
		this.app = {};
		this.contentEl = { empty() {}, addClass() {}, createDiv() {}, createEl() {} };
	}
}
export class Modal {
	constructor(app) {
		this.app = app;
		this.contentEl = { empty() {}, createDiv() {}, createEl() {} };
	}
	open() {}
	close() {}
}
export class SuggestModal extends Modal {
	setPlaceholder() {}
}
export class TextComponent {}
export function normalizePath(path) {
	return path.replace(/\\\\/g, "/").replace(/\\/+/g, "/").replace(/\\/$/, "");
}
export function getLanguage() {
	return "en";
}
export const moment = () => ({ format: () => "2026-05-14" });
export async function requestUrl(options) {
	requestUrl.calls.push(options);
	if (requestUrl.handler) {
		const result = await requestUrl.handler(options);
		if (result && result.headers === undefined) {
			result.headers = {};
		}
		return result;
	}
	return { status: 200, text: "", json: {}, headers: {} };
}
requestUrl.calls = [];
requestUrl.handler = null;
`;

const entry = `
import assert from "node:assert/strict";
import { TFile, requestUrl } from "obsidian";
import BangumiSyncPlugin from "./src/main.ts";
import { BangumiClient, BangumiApiError, BangumiTimeoutError } from "./src/bangumi/client.ts";
import { mapWithConcurrency } from "./src/utils/concurrency.ts";
import { collectionStatusLabel, subjectTypeLabel } from "./src/bangumi/labels.ts";
import { BANGUMI_COLLECTION_TYPES, BANGUMI_SUBJECT_TYPES } from "./src/bangumi/types.ts";
import { DEFAULT_SETTINGS, BANGUMI_FILE_NAME_FORMATS, BANGUMI_STORAGE_LAYOUTS, sanitizeLoadedSettings } from "./src/settings.ts";
import {
	DEFAULT_SUBJECT_NOTE_TEMPLATE,
	LEGACY_DEFAULT_SUBJECT_NOTE_TEMPLATE,
	DEFAULT_SUBJECT_NOTE_TEMPLATE_WITHOUT_SUMMARY,
	MarkdownRenderer
} from "./src/sync/markdown-renderer.ts";
import { NoteWriter } from "./src/sync/note-writer.ts";
import { SubjectNoteIndex } from "./src/sync/subject-note-index.ts";
import { SyncService } from "./src/sync/sync-service.ts";
import { OnAirService } from "./src/sync/on-air-service.ts";
import { PushService } from "./src/sync/push-service.ts";
import { ProgressBoardService } from "./src/sync/progress-board-service.ts";

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
			{ type: 2, episode: { id: 1, type: 0, sort: 1, name: "One", airdate: "2026-01-01" } },
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
			rename: async (file, path) => {
				const content = contents.get(file.path);
				contents.delete(file.path);
				file.path = path;
				file.basename = path.split("/").pop().replace(/\.md$/, "");
				file.extension = path.split(".").pop();
				if (content !== undefined) contents.set(path, content);
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
	requestUrl.calls.length = 0;
	requestUrl.handler = async () => ({ status: 204, text: "", json: undefined, headers: {} });
	await new BangumiClient({
		accessToken: "token",
		userAgent: "test"
	}).patchSubjectCollection({
		subjectId: 123,
		type: BANGUMI_COLLECTION_TYPES.onHold,
		comment: "paused here"
	});
	assert.deepEqual(
		requestUrl.calls.map((call) => [call.method, call.url, call.body]),
		[
			[
				"PATCH",
				"https://api.bgm.tv/v0/users/-/collections/123",
				'{"type":4,"comment":"paused here"}'
			]
		]
	);
	requestUrl.handler = null;
}

{
	requestUrl.calls.length = 0;
	requestUrl.handler = async () => ({ status: 204, text: "", json: undefined, headers: {} });
	await new BangumiClient({
		accessToken: "token",
		userAgent: "test"
	}).patchSubjectEpisodeCollections({
		subjectId: 123,
		episodeIds: [101, 102],
		type: 2
	});
	assert.deepEqual(
		requestUrl.calls.map((call) => [call.method, call.url, call.body]),
		[
			[
				"PATCH",
				"https://api.bgm.tv/v0/users/-/collections/123/episodes",
				'{"episode_id":[101,102],"type":2}'
			]
		]
	);
	requestUrl.handler = null;
}

{
	requestUrl.calls.length = 0;
	await new BangumiClient({
		accessToken: "token",
		userAgent: "test"
	}).putEpisodeCollection({
		episodeId: 101,
		type: 2
	});
	assert.deepEqual(
		requestUrl.calls.map((call) => [call.method, call.url, call.body]),
		[
			[
				"PUT",
				"https://api.bgm.tv/v0/users/-/collections/-/episodes/101",
				'{"type":2}'
			]
		]
	);
}

{
	requestUrl.calls.length = 0;
	requestUrl.handler = (options) => {
		if (options.url.endsWith("/v0/me")) {
			return { status: 200, text: "", json: { username: "me" } };
		}
		if (options.url.endsWith("/calendar")) {
			return {
				status: 200,
				text: "",
				json: [
					{
						weekday: { id: 1, en: "Mon", cn: "星期一" },
						items: [
							{ id: 123, type: BANGUMI_SUBJECT_TYPES.anime, name: "Original", name_cn: "Show" },
							{ id: 999, type: BANGUMI_SUBJECT_TYPES.anime, name: "Other" }
						]
					}
				]
			};
		}
		if (options.url.includes("/collections?") && options.url.includes("type=1")) {
			return {
				status: 200,
				text: "",
				json: {
					total: 1,
					limit: 50,
					offset: 0,
					data: [
						{
							type: BANGUMI_COLLECTION_TYPES.wish,
							subject: {
								id: 123,
								type: BANGUMI_SUBJECT_TYPES.anime,
								name: "Original",
								name_cn: "Show",
								eps: 12
							}
						}
					]
				}
			};
		}
		if (options.url.includes("/collections?") && options.url.includes("type=3")) {
			return {
				status: 200,
				text: "",
				json: { total: 0, limit: 50, offset: 0, data: [] }
			};
		}
		if (options.url.includes("/collections/123/episodes")) {
			return { status: 404, text: "trap: On Air must not fetch episode progress", json: {} };
		}
		return { status: 200, text: "", json: {} };
	};
	const file = new TFile("Bangumi/Show [bgm-123].md");
	const { app, contents, frontmatter, created } = makeApp([file]);
	frontmatter.set(file.path, { bangumi_id: 123 });
	const result = await new OnAirService(app, {
		...DEFAULT_SETTINGS,
		accessToken: "token",
		userAgent: "test",
		syncDirectory: "Bangumi"
	}).update();
	requestUrl.handler = null;
	assert.equal(result.path, "Bangumi/On Air.md");
	assert.equal(result.count, 1);
	assert.equal(created.length, 1);
	const content = contents.get("Bangumi/On Air.md");
	assert.match(content, /<!-- bangumi-onair-start -->/);
	assert.match(content, /## My Collections/);
	assert.match(content, /## All On Air/);
	assert.match(content, /### Monday/);
	assert.match(content, /- \\[ \\] \\[\\[Bangumi\\/Show \\[bgm-123\\]\\|Show\\]\\] · status: wish/);
	assert.doesNotMatch(content, /progress:/);
	assert.match(content, /- \\[Other\\]\\(https:\\/\\/bgm\\.tv\\/subject\\/999\\)/);
	const myCollectionsSection = content.match(/## My Collections[\\s\\S]*?## All On Air/)?.[0] ?? "";
	assert.doesNotMatch(myCollectionsSection, /### Tuesday/);
	assert.equal(
		requestUrl.calls.some((call) => call.url.includes("/collections/123/episodes")),
		false,
		"On Air must not fetch episode progress"
	);
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
	assert.match(rendered, /EP1 One · 2026-01-01 <!-- bgm-ep:1 sort:1 type:0 airdate:2026-01-01 -->/);
}

{
	const rendered = new MarkdownRenderer().renderSubjectNote(makeSubject({
		collection: {
			...makeSubject().collection,
			subject: {
				...makeSubject().collection.subject,
				summary: "A compact subject summary."
			}
		}
	}));
	assert.match(rendered, /## Summary\\n\\nA compact subject summary\\./);
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
	const index = SubjectNoteIndex.build(app, "Bangumi");
	const result = await writer.writeSubjectNote("Bangumi", subject, index);
	assert.equal(result.changed, false);
	assert.equal(modified.length, 0);
}

{
	const fileByFrontmatter = new TFile("Bangumi/anime/do/Any.md");
	const fileByName = new TFile("Bangumi/game/do/Game [bgm-456].md");
	const { app, frontmatter } = makeApp([fileByFrontmatter, fileByName]);
	frontmatter.set(fileByFrontmatter.path, { bangumi_id: 123 });
	const service = new SyncService(app, { ...DEFAULT_SETTINGS, syncDirectory: "Bangumi" });
	const index = SubjectNoteIndex.build(app, "Bangumi");
	const ids = index.ids();
	assert.deepEqual([...ids].sort((a, b) => a - b), [123, 456]);
	assert.equal(index.get(123)?.path, fileByFrontmatter.path);
	assert.equal(index.get(456)?.path, fileByName.path);
	const unchanged = {
		...makeSubject().collection,
		updated_at: "2024-01-01T00:00:00+08:00"
	};
	service.settings.lastSyncedAt = "2026-01-01T00:00:00+08:00";
	assert.equal(service.shouldSkipUnchanged(unchanged), true);
	assert.equal(!service.shouldSkipUnchanged(unchanged) || !ids.has(789), true);
}

{
	const doing = new TFile("Bangumi/anime/do/Doing [bgm-1].md");
	const done = new TFile("Bangumi/anime/collect/Done [bgm-2].md");
	const outside = new TFile("Other/Doing Outside [bgm-3].md");
	const taggedButNotDoing = new TFile("Bangumi/anime/wish/Wish [bgm-4].md");
	const { app, frontmatter } = makeApp([
		doing,
		done,
		outside,
		taggedButNotDoing
	]);
	frontmatter.set(doing.path, {
		bangumi_id: 1,
		title: "Doing",
		type: "anime",
		status: "do",
		progress_done: 3,
		eps_total: 12,
		rating: 8
	});
	frontmatter.set(done.path, {
		bangumi_id: 2,
		title: "Done",
		status: "collect",
		tags: ["bangumi", "anime", "do"]
	});
	frontmatter.set(outside.path, {
		bangumi_id: 3,
		title: "Outside",
		status: "do"
	});
	frontmatter.set(taggedButNotDoing.path, {
		bangumi_id: 4,
		title: "Wish",
		status: "wish",
		tags: ["bangumi", "anime", "do"]
	});

	const items = new ProgressBoardService(app, "Bangumi").listDoingItems();
	assert.equal(items.length, 1);
	assert.equal(items[0].subjectId, 1);
	assert.equal(items[0].title, "Doing");
	assert.equal(items[0].progressDone, 3);
	assert.equal(items[0].epsTotal, 12);
}

{
	requestUrl.calls.length = 0;
	requestUrl.handler = async (options) => {
		if (options.url.endsWith("/v0/me")) {
			return { status: 200, text: "", json: { username: "me" }, headers: {} };
		}
		if (options.url.includes("/collections/123/episodes")) {
			return {
				status: 200,
				text: "",
				headers: {},
				json: {
					total: 1,
					limit: 50,
					offset: 0,
					data: [{ type: 0, episode: { id: 1, type: 0, sort: 1, name: "One" } }]
				}
			};
		}
		if (options.url.endsWith("/v0/users/me/collections/123")) {
			return {
				status: 200,
				text: "",
				headers: {},
				json: {
					type: BANGUMI_COLLECTION_TYPES.do,
					subject: {
						id: 123,
						type: BANGUMI_SUBJECT_TYPES.anime,
						name: "Original"
					}
				}
			};
		}
		throw new Error("Unexpected request: " + options.url);
	};
	const file = new TFile("Bangumi/Original [bgm-123].md");
	const { app, contents, frontmatter } = makeApp([file]);
	app.workspace.getActiveFile = () => file;
	contents.set(
		file.path,
		\`---
bangumi_id: 123
status: do
---

<!-- bangumi-sync-start -->
- [x] EP1 One <!-- bgm-ep:1 sort:1 type:0 airdate: -->
<!-- bangumi-sync-end -->\`
	);
	frontmatter.set(file.path, {
		bangumi_id: 123,
		status: "do"
	});
	const preview = await new PushService(app, {
		...DEFAULT_SETTINGS,
		accessToken: "token",
		userAgent: "test"
	}).prepareCurrentNotePush();
	requestUrl.handler = null;
	assert.equal(preview.username, "me");
	assert.equal(preview.markDone.length, 1);
	assert.ok(
		requestUrl.calls.some((call) =>
			call.url.endsWith("/v0/users/me/collections/123")
		)
	);
	assert.ok(
		!requestUrl.calls.some((call) =>
			call.url.endsWith("/v0/users/-/collections/123")
		)
	);
}

{
	requestUrl.calls.length = 0;
	let episodeFetches = 0;
	requestUrl.handler = async (options) => {
		if (options.url.endsWith("/v0/me")) {
			return { status: 200, text: "", json: { username: "me" }, headers: {} };
		}
		if (options.url.includes("/collections/123/episodes")) {
			if (options.method === "PATCH") {
				return { status: 204, text: "", json: undefined, headers: {} };
			}
			episodeFetches++;
			return {
				status: 200,
				text: "",
				headers: {},
				json: {
					total: 1,
					limit: 50,
					offset: 0,
					data: [{ type: 0, episode: { id: 1, type: 0, sort: 1, name: "One" } }]
				}
			};
		}
		if (options.url.endsWith("/v0/users/me/collections/123")) {
			return {
				status: 200,
				text: "",
				headers: {},
				json: {
					type: BANGUMI_COLLECTION_TYPES.do,
					subject: {
						id: 123,
						type: BANGUMI_SUBJECT_TYPES.anime,
						name: "Original"
					}
				}
			};
		}
		throw new Error("Unexpected request: " + options.url);
	};
	const file = new TFile("Bangumi/Original [bgm-123].md");
	const { app, contents, frontmatter } = makeApp([file]);
	app.workspace.getActiveFile = () => file;
	contents.set(
		file.path,
		\`---
bangumi_id: 123
status: do
---

<!-- bangumi-sync-start -->
- [x] EP1 One <!-- bgm-ep:1 sort:1 type:0 airdate: -->
<!-- bangumi-sync-end -->\`
	);
	frontmatter.set(file.path, {
		bangumi_id: 123,
		status: "do"
	});
	const service = new PushService(app, {
		...DEFAULT_SETTINGS,
		accessToken: "token",
		userAgent: "test"
	});
	const preview = await service.prepareCurrentNotePush();
	await assert.rejects(
		() => service.executePreparedPush(preview),
		/error.*1|episode.*1|章节.*1/i
	);
	requestUrl.handler = null;
	assert.equal(episodeFetches, 2);
}

{
	requestUrl.calls.length = 0;
	let collectionReads = 0;
	requestUrl.handler = async (options) => {
		if (options.url.endsWith("/v0/me")) {
			return { status: 200, text: "", json: { username: "me" }, headers: {} };
		}
		if (options.url.includes("/collections/123/episodes")) {
			throw new Error("Status-only push should not fetch episode collections");
		}
		if (options.url.endsWith("/v0/users/-/collections/123") && options.method === "PATCH") {
			assert.equal(options.body, '{"type":4}');
			return { status: 204, text: "", json: undefined, headers: {} };
		}
		if (options.url.endsWith("/v0/users/me/collections/123")) {
			collectionReads++;
			return {
				status: 200,
				text: "",
				headers: {},
				json: {
					type: collectionReads < 3
						? BANGUMI_COLLECTION_TYPES.do
						: BANGUMI_COLLECTION_TYPES.onHold,
					subject: {
						id: 123,
						type: BANGUMI_SUBJECT_TYPES.anime,
						name: "Original"
					}
				}
			};
		}
		throw new Error("Unexpected request: " + options.url);
	};
	const file = new TFile("Bangumi/anime/do/Original [bgm-123].md");
	const { app, contents, frontmatter } = makeApp([file]);
	app.workspace.getActiveFile = () => file;
	contents.set(
		file.path,
		\`---
bangumi_id: 123
status: on_hold
---

<!-- bangumi-sync-start -->
<!-- bangumi-sync-end -->\`
	);
	frontmatter.set(file.path, {
		bangumi_id: 123,
		status: "on_hold"
	});
	const service = new PushService(app, {
		...DEFAULT_SETTINGS,
		accessToken: "token",
		userAgent: "test",
		storageLayout: BANGUMI_STORAGE_LAYOUTS.subjectThenCollection
	});
	const preview = await service.prepareCurrentNotePush();
	assert.equal(preview.localCollectionType, BANGUMI_COLLECTION_TYPES.onHold);
	assert.equal(preview.markDone.length, 0);
	const result = await service.executePreparedPush(preview);
	requestUrl.handler = null;
	assert.equal(result.finalStatus, "on_hold");
	assert.equal(result.movedPath, "Bangumi/anime/on_hold/Original [bgm-123].md");
	assert.equal(file.path, "Bangumi/anime/on_hold/Original [bgm-123].md");
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

	const pluginWithPreSummaryDefault = new BangumiSyncPlugin();
	pluginWithPreSummaryDefault.__data = {
		subjectNoteTemplate: DEFAULT_SUBJECT_NOTE_TEMPLATE_WITHOUT_SUMMARY
	};
	await pluginWithPreSummaryDefault.loadSettings();
	assert.equal(pluginWithPreSummaryDefault.settings.subjectNoteTemplate, DEFAULT_SUBJECT_NOTE_TEMPLATE);
}

{
	const ok = sanitizeLoadedSettings({
		accessToken: "tok",
		incrementalSync: false,
		fileNameFormat: "id-only",
		subjectTypes: [2, 4],
		collectionTypes: [3]
	});
	assert.equal(ok.invalidFields.length, 0);
	assert.equal(ok.settings.accessToken, "tok");
	assert.equal(ok.settings.incrementalSync, false);
	assert.equal(ok.settings.fileNameFormat, "id-only");
	assert.deepEqual(ok.settings.subjectTypes, [2, 4]);

	const dirty = sanitizeLoadedSettings({
		accessToken: 123,
		incrementalSync: "yes",
		fileNameFormat: "weird-format",
		storageLayout: null,
		subjectTypes: [2, "anime", 999, 2],
		collectionTypes: "all",
		unknownField: 42
	});
	assert.equal(dirty.settings.accessToken, undefined);
	assert.equal(dirty.settings.incrementalSync, undefined);
	assert.equal(dirty.settings.fileNameFormat, undefined);
	assert.equal(dirty.settings.storageLayout, undefined);
	assert.deepEqual(dirty.settings.subjectTypes, [2]);
	assert.equal(dirty.settings.collectionTypes, undefined);
	const expectedInvalid = [
		"accessToken",
		"incrementalSync",
		"fileNameFormat",
		"storageLayout",
		"subjectTypes",
		"collectionTypes"
	];
	for (const key of expectedInvalid) {
		assert.ok(dirty.invalidFields.includes(key), \`expected invalidFields to include \${key}\`);
	}

	const garbage = sanitizeLoadedSettings("not-an-object");
	assert.deepEqual(garbage.settings, {});
	assert.ok(garbage.invalidFields.length > 0);

	const empty = sanitizeLoadedSettings(undefined);
	assert.deepEqual(empty.settings, {});
	assert.equal(empty.invalidFields.length, 0);

	const corruptPlugin = new BangumiSyncPlugin();
	corruptPlugin.__data = {
		accessToken: 123,
		subjectNoteTemplate: DEFAULT_SUBJECT_NOTE_TEMPLATE,
		subjectTypes: ["bogus"],
		incrementalSync: "yes"
	};
	await corruptPlugin.loadSettings();
	assert.equal(corruptPlugin.settings.accessToken, DEFAULT_SETTINGS.accessToken);
	assert.deepEqual(corruptPlugin.settings.subjectTypes, DEFAULT_SETTINGS.subjectTypes);
	assert.equal(corruptPlugin.settings.incrementalSync, DEFAULT_SETTINGS.incrementalSync);
}

// HTTP retry: 429 + Retry-After then 200
{
	requestUrl.calls.length = 0;
	let call = 0;
	requestUrl.handler = async () => {
		call++;
		if (call === 1) {
			return { status: 429, text: "rate limited", json: {}, headers: { "Retry-After": "0" } };
		}
		return { status: 200, text: "", json: { username: "ok" }, headers: {} };
	};
	const client = new BangumiClient({
		accessToken: "tok",
		userAgent: "test",
		retryBaseDelayMs: 1,
		maxRetryDelayMs: 5
	});
	const t0 = Date.now();
	const me = await client.getMe();
	const elapsed = Date.now() - t0;
	requestUrl.handler = null;
	assert.equal(me.username, "ok");
	assert.equal(call, 2);
	assert.ok(elapsed < 1000, \`429 with Retry-After:0 should not delay long, took \${elapsed}ms\`);
}

// HTTP retry: 500 -> 503 -> 200
{
	requestUrl.calls.length = 0;
	let call = 0;
	requestUrl.handler = async () => {
		call++;
		if (call === 1) return { status: 500, text: "boom", json: {}, headers: {} };
		if (call === 2) return { status: 503, text: "again", json: {}, headers: {} };
		return { status: 200, text: "", json: { username: "ok" }, headers: {} };
	};
	const client = new BangumiClient({
		accessToken: "tok",
		userAgent: "test",
		retryBaseDelayMs: 1,
		maxRetryDelayMs: 5
	});
	const me = await client.getMe();
	requestUrl.handler = null;
	assert.equal(me.username, "ok");
	assert.equal(call, 3);
}

// HTTP retry: 401 must NOT retry
{
	requestUrl.calls.length = 0;
	let call = 0;
	requestUrl.handler = async () => {
		call++;
		return { status: 401, text: "nope", json: {}, headers: {} };
	};
	const client = new BangumiClient({
		accessToken: "tok",
		userAgent: "test",
		retryBaseDelayMs: 1
	});
	let caught;
	try {
		await client.getMe();
	} catch (e) {
		caught = e;
	}
	requestUrl.handler = null;
	assert.ok(caught instanceof BangumiApiError, "expected BangumiApiError");
	assert.equal(caught.status, 401);
	assert.equal(call, 1, "401 must not retry");
}

// HTTP retry: max retries exhausted -> throws BangumiApiError with last status
{
	requestUrl.calls.length = 0;
	let call = 0;
	requestUrl.handler = async () => {
		call++;
		return { status: 503, text: "down", json: {}, headers: {} };
	};
	const client = new BangumiClient({
		accessToken: "tok",
		userAgent: "test",
		maxRetries: 2,
		retryBaseDelayMs: 1,
		maxRetryDelayMs: 5
	});
	let caught;
	try {
		await client.getMe();
	} catch (e) {
		caught = e;
	}
	requestUrl.handler = null;
	assert.ok(caught instanceof BangumiApiError);
	assert.equal(caught.status, 503);
	assert.equal(call, 3, "should attempt 1 + 2 retries = 3 times");
}

// HTTP timeout: handler never resolves -> BangumiTimeoutError
{
	requestUrl.calls.length = 0;
	requestUrl.handler = () => new Promise(() => {});
	const client = new BangumiClient({
		accessToken: "tok",
		userAgent: "test",
		requestTimeoutMs: 30,
		maxRetries: 0
	});
	let caught;
	try {
		await client.getMe();
	} catch (e) {
		caught = e;
	}
	requestUrl.handler = null;
	assert.ok(caught instanceof BangumiTimeoutError, \`expected BangumiTimeoutError, got \${caught}\`);
	assert.equal(caught.timeoutMs, 30);
}

// labels: shared switch returns the same string set everyone used
{
	assert.equal(collectionStatusLabel(1), "wish");
	assert.equal(collectionStatusLabel(2), "collect");
	assert.equal(collectionStatusLabel(3), "do");
	assert.equal(collectionStatusLabel(4), "on_hold");
	assert.equal(collectionStatusLabel(5), "dropped");
	assert.equal(collectionStatusLabel(99), "99");

	assert.equal(subjectTypeLabel(1), "book");
	assert.equal(subjectTypeLabel(2), "anime");
	assert.equal(subjectTypeLabel(3), "music");
	assert.equal(subjectTypeLabel(4), "game");
	assert.equal(subjectTypeLabel(6), "real");
	assert.equal(subjectTypeLabel(99), "99");
}

// mapWithConcurrency: limits in-flight workers and preserves output order
{
	const items = [10, 50, 30, 20, 40, 5];
	let inFlight = 0;
	let peakInFlight = 0;
	const results = await mapWithConcurrency(items, 3, async (item) => {
		inFlight++;
		if (inFlight > peakInFlight) peakInFlight = inFlight;
		await new Promise((r) => setTimeout(r, item));
		inFlight--;
		return item * 2;
	});
	assert.deepEqual(results, [20, 100, 60, 40, 80, 10]);
	assert.ok(peakInFlight <= 3, \`peak in-flight \${peakInFlight} should not exceed 3\`);
	assert.ok(peakInFlight >= 2, \`peak in-flight \${peakInFlight} should reach >= 2 with 6 items at concurrency 3\`);
}

// mapWithConcurrency: empty list, concurrency 0/negative coerced to 1
{
	assert.deepEqual(await mapWithConcurrency([], 4, async () => 1), []);
	const r = await mapWithConcurrency([1, 2, 3], 0, async (n) => n + 1);
	assert.deepEqual(r, [2, 3, 4]);
}

// mapWithConcurrency: rejection propagates
{
	let caught;
	try {
		await mapWithConcurrency([1, 2, 3], 2, async (n) => {
			if (n === 2) throw new Error("boom");
			return n;
		});
	} catch (e) {
		caught = e;
	}
	assert.ok(caught instanceof Error);
	assert.equal(caught.message, "boom");
}

// BangumiClient.getAllUserCollections: paginates across pages
{
	requestUrl.calls.length = 0;
	requestUrl.handler = async (options) => {
		const url = new URL(options.url);
		const offset = Number(url.searchParams.get("offset"));
		const limit = Number(url.searchParams.get("limit"));
		const total = 130;
		const pageData = [];
		for (let i = offset; i < Math.min(offset + limit, total); i++) {
			pageData.push({ subject: { id: i }, type: 3 });
		}
		return { status: 200, text: "", json: { total, limit, offset, data: pageData }, headers: {} };
	};
	const client = new BangumiClient({ accessToken: "tok", userAgent: "test" });
	const all = await client.getAllUserCollections({
		username: "me",
		subjectType: 2,
		collectionType: 3,
		pageSize: 50
	});
	requestUrl.handler = null;
	assert.equal(all.length, 130);
	assert.equal(all[0].subject.id, 0);
	assert.equal(all[129].subject.id, 129);
	assert.equal(requestUrl.calls.length, 3);
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
