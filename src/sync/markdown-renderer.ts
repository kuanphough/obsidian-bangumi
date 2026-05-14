import { BangumiSyncedSubject } from "../bangumi/types";

export const SYNC_BLOCK_START = "<!-- bangumi-sync-start -->";
export const SYNC_BLOCK_END = "<!-- bangumi-sync-end -->";

export const LEGACY_DEFAULT_SUBJECT_NOTE_TEMPLATE = `---
bangumi_id: {{bangumi_id}}
title: {{title_json}}
original_title: {{original_title_json}}
type: {{type}}
status: {{status}}
rating: {{rating}}
eps_total: {{eps_total}}
progress_done: {{progress_done}}
progress_total: {{progress_total}}
progress_percent: {{progress_percent}}
progress_available: {{progress_available}}
next_episode: {{next_episode_json}}
next_episode_sort: {{next_episode_sort}}
last_done_episode: {{last_done_episode_json}}
last_done_episode_sort: {{last_done_episode_sort}}
air_date: {{air_date_yaml}}
updated_at: {{updated_at_yaml}}
bangumi_tags: {{bangumi_tags_json}}
comment: {{comment_json}}
tags:
{{tags_yaml}}
cover: {{cover_yaml}}
---

# {{title}}

{{sync_block_start}}
{{cover_image}}
## Progress

{{progress}}

{{sync_block_end}}

## Notes
`;

export const DEFAULT_SUBJECT_NOTE_TEMPLATE = `---
bangumi_id: {{bangumi_id}}
title: {{title_json}}
original_title: {{original_title_json}}
type: {{type}}
status: {{status}}
rating: {{rating}}
eps_total: {{eps_total}}
progress_done: {{progress_done}}
updated_at: {{updated_at_yaml}}
bangumi_tags: {{bangumi_tags_json}}
comment: {{comment_json}}
tags:
{{tags_yaml}}
cover: {{cover_yaml}}
---

# {{title}}

{{sync_block_start}}
{{cover_image}}
## Progress

{{progress}}

{{sync_block_end}}

## Notes
`;

export class MarkdownRenderer {
	constructor(private readonly template = DEFAULT_SUBJECT_NOTE_TEMPLATE) {}

	renderSubjectNote(subject: BangumiSyncedSubject): string {
		const bangumiSubject = subject.collection.subject;
		const title = bangumiSubject.name_cn || bangumiSubject.name;
		const cover = bangumiSubject.images?.large || bangumiSubject.images?.common;
		const rating = subject.collection.rate ?? "";
		const updatedAt = subject.collection.updated_at ?? "";
		const status = this.renderCollectionStatus(subject.collection.type);
		const subjectType = this.renderSubjectType(bangumiSubject.type);
		const tags = subject.collection.tags ?? [];
		const comment = subject.collection.comment ?? "";
		const progressSummary = this.getProgressSummary(subject);
		const progress = this.renderEpisodeChecklist(subject);
		const template = this.hasSyncBlockMarkers(this.template)
			? this.template
			: DEFAULT_SUBJECT_NOTE_TEMPLATE;

		return this.renderTemplate(template, {
			air_date: bangumiSubject.date ?? "",
			air_date_yaml: this.renderYamlScalar(bangumiSubject.date ?? ""),
			bangumi_id: String(bangumiSubject.id),
			bangumi_tags_json: JSON.stringify(tags),
			comment,
			comment_json: JSON.stringify(comment),
			cover: cover ?? "",
			cover_image: cover ? `![](${cover})` : "",
			cover_yaml: this.renderYamlScalar(cover ?? ""),
			eps_total: String(bangumiSubject.eps ?? ""),
			last_done_episode_json: JSON.stringify(
				progressSummary.lastDoneEpisodeTitle
			),
			last_done_episode_sort: progressSummary.lastDoneEpisodeSort,
			next_episode_json: JSON.stringify(progressSummary.nextEpisodeTitle),
			next_episode_sort: progressSummary.nextEpisodeSort,
			original_title: bangumiSubject.name,
			original_title_json: JSON.stringify(bangumiSubject.name),
			progress,
			progress_available: progressSummary.available ? "true" : "false",
			progress_done: String(progressSummary.done),
			progress_percent: String(progressSummary.percent),
			progress_total: String(progressSummary.total),
			rating: String(rating),
			status,
			sync_block_end: SYNC_BLOCK_END,
			sync_block_start: SYNC_BLOCK_START,
			tags_yaml: ["bangumi", subjectType, status]
				.map((tag) => `  - ${tag}`)
				.join("\n"),
			title,
			title_json: JSON.stringify(title),
			type: subjectType,
			updated_at: updatedAt,
			updated_at_yaml: this.renderYamlScalar(updatedAt)
		});
	}

	mergeSyncedContent(existingContent: string, nextContent: string): string {
		return this.mergeSyncedBlock(
			this.mergeFrontmatter(existingContent, nextContent),
			nextContent
		);
	}

	private mergeFrontmatter(existingContent: string, nextContent: string): string {
		const nextFrontmatter = this.extractFrontmatter(nextContent);
		if (!nextFrontmatter) {
			return existingContent;
		}

		const existingFrontmatter = this.extractFrontmatter(existingContent);
		if (!existingFrontmatter) {
			return `${nextFrontmatter.block}${existingContent}`;
		}

		return `${nextFrontmatter.block}${existingContent.slice(existingFrontmatter.end)}`;
	}

	private extractFrontmatter(content: string): { block: string; end: number } | null {
		const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
		if (!match) {
			return null;
		}

		return {
			block: match[0],
			end: match[0].length
		};
	}

	private mergeSyncedBlock(existingContent: string, nextContent: string): string {
		const start = existingContent.indexOf(SYNC_BLOCK_START);
		const end = existingContent.indexOf(SYNC_BLOCK_END);

		if (start === -1 || end === -1 || end < start) {
			return nextContent;
		}

		const nextStart = nextContent.indexOf(SYNC_BLOCK_START);
		const nextEnd = nextContent.indexOf(SYNC_BLOCK_END);

		if (nextStart === -1 || nextEnd === -1 || nextEnd < nextStart) {
			return existingContent;
		}

		const before = existingContent.slice(0, start);
		const after = existingContent.slice(end + SYNC_BLOCK_END.length);
		const syncedBlock = nextContent.slice(nextStart, nextEnd + SYNC_BLOCK_END.length);

		return `${before}${syncedBlock}${after}`;
	}

	private renderEpisodeChecklist(subject: BangumiSyncedSubject): string {
		if (subject.episodeSyncError) {
			return `- [ ] Episode progress unavailable: ${subject.episodeSyncError}`;
		}

		if (subject.episodes.length === 0) {
			return "- [ ] Episode progress unavailable.";
		}

		const lines = subject.episodes
			.map((item) => {
				const episode = item.episode;
				if (!episode) {
					return null;
				}
				const checked = item.type > 0 ? "x" : " ";
				const title = episode.name_cn || episode.name || `Episode ${episode.sort}`;
				return `- [${checked}] EP${episode.sort} ${title}`;
			})
			.filter((line): line is string => line !== null)
			.join("\n");

		return lines || "- [ ] Episode progress unavailable.";
	}

	private getProgressSummary(subject: BangumiSyncedSubject): {
		available: boolean;
		done: number;
		total: number;
		percent: number;
		nextEpisodeTitle: string;
		nextEpisodeSort: string;
		lastDoneEpisodeTitle: string;
		lastDoneEpisodeSort: string;
	} {
		const validEpisodes = subject.episodes.filter((item) => item.episode !== null);
		const total = subject.collection.subject.eps || validEpisodes.length;
		const doneEpisodes = validEpisodes.filter((item) => item.type > 0);
		const done = doneEpisodes.length;
		const percent = total > 0 ? Math.round((done / total) * 100) : 0;
		const nextEpisode = validEpisodes.find((item) => item.type <= 0)?.episode;
		const lastDoneEpisode = doneEpisodes.at(-1)?.episode;
		const available = !subject.episodeSyncError && validEpisodes.length > 0;

		return {
			available,
			done,
			total,
			percent,
			nextEpisodeTitle: nextEpisode ? this.getEpisodeTitle(nextEpisode) : "",
			nextEpisodeSort: nextEpisode ? String(nextEpisode.sort) : "\"\"",
			lastDoneEpisodeTitle: lastDoneEpisode
				? this.getEpisodeTitle(lastDoneEpisode)
				: "",
			lastDoneEpisodeSort: lastDoneEpisode
				? String(lastDoneEpisode.sort)
				: "\"\""
		};
	}

	private hasSyncBlockMarkers(template: string): boolean {
		return (
			template.includes("{{sync_block_start}}") &&
			template.includes("{{sync_block_end}}")
		);
	}

	private renderTemplate(
		template: string,
		values: Record<string, string>
	): string {
		return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
			return values[key] ?? match;
		});
	}

	private renderYamlScalar(value: string): string {
		return value || "\"\"";
	}

	private getEpisodeTitle(episode: { sort: number; name?: string; name_cn?: string }): string {
		const title = episode.name_cn || episode.name || "";
		return title ? `EP${episode.sort} ${title}` : `EP${episode.sort}`;
	}

	private renderCollectionStatus(type: number): string {
		switch (type) {
			case 1:
				return "wish";
			case 2:
				return "collect";
			case 3:
				return "do";
			case 4:
				return "on_hold";
			case 5:
				return "dropped";
			default:
				return String(type);
		}
	}

	private renderSubjectType(type: number): string {
		switch (type) {
			case 1:
				return "book";
			case 2:
				return "anime";
			case 3:
				return "music";
			case 4:
				return "game";
			case 6:
				return "real";
			default:
				return String(type);
		}
	}
}
