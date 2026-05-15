import { App, TFile, normalizePath } from "obsidian";

import {
	BANGUMI_COLLECTION_TYPES,
	BANGUMI_SUBJECT_TYPES,
	BangumiCalendarDay,
	BangumiCollection,
	BangumiCollectionType
} from "../bangumi/types";
import { BangumiClient } from "../bangumi/client";
import type { BangumiSyncSettings } from "../settings";
import { formatLocalDateTime } from "../date-format";
import { t } from "../i18n";

export interface OnAirUpdateResult {
	path: string;
	changed: boolean;
	count: number;
	message: string;
}

const ON_AIR_BLOCK_START = "<!-- bangumi-onair-start -->";
const ON_AIR_BLOCK_END = "<!-- bangumi-onair-end -->";
const ON_AIR_FILE_NAME = "On Air.md";
const PAGE_LIMIT = 50;
const ON_AIR_COLLECTION_TYPES: BangumiCollectionType[] = [
	BANGUMI_COLLECTION_TYPES.wish,
	BANGUMI_COLLECTION_TYPES.do
];

export class OnAirService {
	constructor(
		private readonly app: App,
		private readonly settings: BangumiSyncSettings
	) {}

	async update(): Promise<OnAirUpdateResult> {
		if (!this.settings.accessToken) {
			return {
				path: "",
				changed: false,
				count: 0,
				message: t("noToken")
			};
		}

		const client = new BangumiClient({
			accessToken: this.settings.accessToken,
			userAgent: this.settings.userAgent
		});
		const username = this.settings.username || (await client.getMe()).username;
		const [calendar, collections] = await Promise.all([
			client.getCalendar(),
			this.fetchOnAirCollections(client, username)
		]);
		const collectionBySubjectId = new Map<number, BangumiCollection>();
		for (const collection of collections) {
			collectionBySubjectId.set(collection.subject.id, collection);
		}
		const localNoteBySubjectId = this.buildLocalNoteIndex();

		const myRows = await this.buildMyRows(
			calendar,
			collectionBySubjectId,
			localNoteBySubjectId
		);
		const allRows = this.buildAllRows(calendar, localNoteBySubjectId);
		const directory = normalizePath(this.settings.syncDirectory || "Bangumi");
		await this.ensureFolder(directory);
		const path = normalizePath(`${directory}/${ON_AIR_FILE_NAME}`);
		const content = this.renderOnAirNote(myRows, allRows);
		const existing = this.app.vault.getAbstractFileByPath(path);

		if (existing instanceof TFile) {
			const previous = await this.app.vault.read(existing);
			const next = this.mergeOnAirBlock(previous, content);
			if (next === previous) {
				return {
					path,
					changed: false,
					count: this.countRows(myRows),
					message: t("onAirNoteUnchanged", { path })
				};
			}
			await this.app.vault.modify(existing, next);
			return {
				path,
				changed: true,
				count: this.countRows(myRows),
				message: t("onAirNoteUpdated", { path })
			};
		}

		await this.app.vault.create(path, content);
		return {
			path,
			changed: true,
			count: this.countRows(myRows),
			message: t("onAirNoteUpdated", { path })
		};
	}

	private async fetchOnAirCollections(
		client: BangumiClient,
		username: string
	): Promise<BangumiCollection[]> {
		const collections: BangumiCollection[] = [];
		for (const collectionType of ON_AIR_COLLECTION_TYPES) {
			let offset = 0;
			while (true) {
				const page = await client.getCollections({
					username,
					subjectType: BANGUMI_SUBJECT_TYPES.anime,
					collectionType,
					limit: PAGE_LIMIT,
					offset
				});
				collections.push(...page.data);
				offset += page.data.length;
				if (page.data.length === 0 || offset >= page.total) {
					break;
				}
			}
		}
		return collections;
	}

	private async buildMyRows(
		calendar: BangumiCalendarDay[],
		collectionBySubjectId: Map<number, BangumiCollection>,
		localNoteBySubjectId: Map<number, TFile>
	): Promise<Map<number, string[]>> {
		const rows = new Map<number, string[]>();
		for (let weekday = 1; weekday <= 7; weekday += 1) {
			rows.set(weekday, []);
		}

		for (const day of calendar) {
			const weekday = this.normalizeWeekday(day.weekday.id);
			for (const subject of day.items) {
				const collection = collectionBySubjectId.get(subject.id);
				if (!collection) {
					continue;
				}
				rows
					.get(weekday)
					?.push(this.renderOnAirRow(collection, localNoteBySubjectId));
			}
		}

		return rows;
	}

	private buildAllRows(
		calendar: BangumiCalendarDay[],
		localNoteBySubjectId: Map<number, TFile>
	): Map<number, string[]> {
		const rows = new Map<number, string[]>();
		for (let weekday = 1; weekday <= 7; weekday += 1) {
			rows.set(weekday, []);
		}

		for (const day of calendar) {
			const weekday = this.normalizeWeekday(day.weekday.id);
			for (const subject of day.items) {
				rows
					.get(weekday)
					?.push(this.renderCalendarSubjectRow(subject, localNoteBySubjectId));
			}
		}

		return rows;
	}

	private renderOnAirRow(
		collection: BangumiCollection,
		localNoteBySubjectId: Map<number, TFile>
	): string {
		const title = collection.subject.name_cn || collection.subject.name;
		const link = this.getSubjectLink(
			collection.subject.id,
			title,
			localNoteBySubjectId
		);
		const status = this.renderCollectionStatus(collection.type);
		return `- [ ] ${link} · status: ${status}`;
	}

	private renderCalendarSubjectRow(
		subject: {
			id: number;
			name: string;
			name_cn?: string;
		},
		localNoteBySubjectId: Map<number, TFile>
	): string {
		const title = subject.name_cn || subject.name;
		return `- ${this.getSubjectLink(subject.id, title, localNoteBySubjectId)}`;
	}

	private renderOnAirNote(
		myRows: Map<number, string[]>,
		allRows: Map<number, string[]>
	): string {
		return [
			"# On Air",
			"",
			ON_AIR_BLOCK_START,
			`_Updated: ${formatLocalDateTime(new Date())}_`,
			"",
			"## My Collections",
			"",
			...this.renderWeekdaySections(myRows, 3, "_No matching collection._", {
				hideEmptySections: true
			}),
			"## All On Air",
			"",
			...this.renderWeekdaySections(allRows, 3, "_No broadcasts._"),
			ON_AIR_BLOCK_END,
			""
		].join("\n");
	}

	private renderWeekdaySections(
		rows: Map<number, string[]>,
		headingLevel: number,
		emptyText: string,
		options: { hideEmptySections?: boolean } = {}
	): string[] {
		const heading = "#".repeat(headingLevel);
		return Array.from({ length: 7 }, (_, index) => index + 1).flatMap(
			(weekday) => {
				const dayRows = rows.get(weekday) ?? [];
				if (options.hideEmptySections && dayRows.length === 0) {
					return [];
				}
				return [
					`${heading} ${this.renderWeekday(weekday)}`,
					"",
					...(dayRows.length > 0 ? dayRows : [emptyText]),
					""
				];
			}
		);
	}

	private mergeOnAirBlock(existingContent: string, nextContent: string): string {
		const start = existingContent.indexOf(ON_AIR_BLOCK_START);
		const end = existingContent.indexOf(ON_AIR_BLOCK_END);
		if (start === -1 || end === -1 || end < start) {
			return `${nextContent.trimEnd()}\n\n${existingContent}`;
		}

		const nextStart = nextContent.indexOf(ON_AIR_BLOCK_START);
		const nextEnd = nextContent.indexOf(ON_AIR_BLOCK_END);
		const before = existingContent.slice(0, start);
		const after = existingContent.slice(end + ON_AIR_BLOCK_END.length);
		const block = nextContent.slice(nextStart, nextEnd + ON_AIR_BLOCK_END.length);
		return `${before}${block}${after}`;
	}

	private getSubjectLink(
		subjectId: number,
		title: string,
		localNoteBySubjectId: Map<number, TFile>
	): string {
		const file = localNoteBySubjectId.get(subjectId);
		const escapedTitle = this.escapeMarkdownLinkText(title);
		if (file) {
			return `[[${file.path.replace(/\.md$/, "")}|${escapedTitle}]]`;
		}
		return `[${escapedTitle}](https://bgm.tv/subject/${subjectId})`;
	}

	private buildLocalNoteIndex(): Map<number, TFile> {
		const directory = normalizePath(this.settings.syncDirectory || "Bangumi");
		const index = new Map<number, TFile>();
		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!file.path.startsWith(`${directory}/`) && file.parent?.path !== directory) {
				continue;
			}

			const frontmatterId = Number(this.getFrontmatterBangumiId(file));
			if (Number.isInteger(frontmatterId) && frontmatterId > 0) {
				index.set(frontmatterId, file);
				continue;
			}

			const idMatch = file.basename.match(/bgm-(\d+)/);
			if (idMatch) {
				index.set(Number(idMatch[1]), file);
			}
		}
		return index;
	}

	private getFrontmatterBangumiId(file: TFile): unknown {
		const frontmatter: unknown =
			this.app.metadataCache.getFileCache(file)?.frontmatter;
		if (typeof frontmatter !== "object" || frontmatter === null) {
			return undefined;
		}

		return (frontmatter as { bangumi_id?: unknown }).bangumi_id;
	}

	private normalizeWeekday(weekday: number): number {
		return weekday >= 1 && weekday <= 7 ? weekday : 7;
	}

	private renderWeekday(weekday: number): string {
		const labels = [
			t("weekdayMonday"),
			t("weekdayTuesday"),
			t("weekdayWednesday"),
			t("weekdayThursday"),
			t("weekdayFriday"),
			t("weekdaySaturday"),
			t("weekdaySunday")
		];
		return labels[weekday - 1] ?? String(weekday);
	}

	private renderCollectionStatus(type: number): string {
		switch (type) {
			case BANGUMI_COLLECTION_TYPES.wish:
				return "wish";
			case BANGUMI_COLLECTION_TYPES.collect:
				return "collect";
			case BANGUMI_COLLECTION_TYPES.do:
				return "do";
			case BANGUMI_COLLECTION_TYPES.onHold:
				return "on_hold";
			case BANGUMI_COLLECTION_TYPES.dropped:
				return "dropped";
			default:
				return String(type);
		}
	}

	private countRows(rows: Map<number, string[]>): number {
		return Array.from(rows.values()).reduce(
			(total, dayRows) => total + dayRows.length,
			0
		);
	}

	private escapeMarkdownLinkText(value: string): string {
		return value.replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\n/g, " ");
	}

	private async ensureFolder(path: string): Promise<void> {
		const parts = normalizePath(path).split("/");
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}
}
