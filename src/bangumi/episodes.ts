import type { BangumiEpisode, BangumiEpisodeCollection } from "./types";

export function episodeTypeLabel(type: number): string {
	switch (type) {
		case 0:
			return "EP";
		case 1:
			return "SP";
		case 2:
			return "OP";
		case 3:
			return "ED";
		case 4:
			return "PV";
		case 5:
			return "MAD";
		case 6:
			return "Other";
		default:
			return `Type${type}`;
	}
}

export function compareEpisodesByTypeThenSort(
	left: BangumiEpisode,
	right: BangumiEpisode
): number {
	return left.type - right.type || left.sort - right.sort || left.id - right.id;
}

export function sortEpisodeCollectionsByTypeThenSort(
	episodes: BangumiEpisodeCollection[]
): BangumiEpisodeCollection[] {
	return [...episodes].sort((left, right) => {
		if (!left.episode && !right.episode) return 0;
		if (!left.episode) return 1;
		if (!right.episode) return -1;
		return compareEpisodesByTypeThenSort(left.episode, right.episode);
	});
}
