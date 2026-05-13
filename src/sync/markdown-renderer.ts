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

		return [
			"---",
			`bangumi_id: ${bangumiSubject.id}`,
			"type: anime",
			`status: ${subject.collection.type}`,
			`rating: ${rating}`,
			`eps_total: ${bangumiSubject.eps ?? ""}`,
			`updated_at: ${JSON.stringify(updatedAt)}`,
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
			`- Original title: ${bangumiSubject.name}`,
			bangumiSubject.date ? `- Air date: ${bangumiSubject.date}` : "",
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
		if (subject.episodes.length === 0) {
			return "- [ ] Episode sync will appear here after the API flow is completed.";
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
}
