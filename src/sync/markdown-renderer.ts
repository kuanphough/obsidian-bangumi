import { BangumiSyncedSubject } from "../bangumi/types";

export const SYNC_BLOCK_START = "<!-- bangumi-sync-start -->";
export const SYNC_BLOCK_END = "<!-- bangumi-sync-end -->";

export class MarkdownRenderer {
	renderSubjectNote(subject: BangumiSyncedSubject): string {
		const bangumiSubject = subject.collection.subject;
		const title = bangumiSubject.name_cn || bangumiSubject.name;
		const cover = bangumiSubject.images?.large || bangumiSubject.images?.common;
		const rating = subject.collection.rate ?? "";
		const updatedAt = subject.collection.updated_at ?? "";
		const status = this.renderCollectionStatus(subject.collection.type);
		const tags = subject.collection.tags ?? [];
		const comment = subject.collection.comment ?? "";

		return [
			"---",
			`bangumi_id: ${bangumiSubject.id}`,
			"type: anime",
			`collection_type: ${subject.collection.type}`,
			`status: ${status}`,
			`rating: ${rating}`,
			`eps_total: ${bangumiSubject.eps ?? ""}`,
			`updated_at: ${JSON.stringify(updatedAt)}`,
			`bangumi_tags: ${JSON.stringify(tags)}`,
			`comment: ${JSON.stringify(comment)}`,
			"tags:",
			"  - bangumi",
			"  - anime",
			"---",
			"",
			`# ${title}`,
			"",
			SYNC_BLOCK_START,
			"",
			cover ? `![](${cover})` : "",
			"",
			"## Progress",
			"",
			this.renderEpisodeChecklist(subject),
			"",
			"## Bangumi",
			"",
			`- Subject ID: ${bangumiSubject.id}`,
			`- Status: ${status}`,
			`- User rating: ${rating || "N/A"}`,
			`- Original title: ${bangumiSubject.name}`,
			bangumiSubject.date ? `- Air date: ${bangumiSubject.date}` : "",
			bangumiSubject.eps ? `- Episodes: ${bangumiSubject.eps}` : "",
			tags.length > 0 ? `- User tags: ${tags.join(", ")}` : "",
			comment ? `- User comment: ${comment}` : "",
			"",
			SYNC_BLOCK_END,
			"",
			"## Notes",
			""
		]
			.filter((line) => line !== null)
			.join("\n");
	}

	mergeSyncedBlock(existingContent: string, nextContent: string): string {
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

		return subject.episodes
			.map((item) => {
				const episode = item.episode;
				const checked = item.type > 0 ? "x" : " ";
				const title = episode.name_cn || episode.name || `Episode ${episode.sort}`;
				return `- [${checked}] EP${episode.sort} ${title}`;
			})
			.join("\n");
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
}
