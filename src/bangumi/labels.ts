import { BANGUMI_COLLECTION_TYPES, BANGUMI_SUBJECT_TYPES } from "./types";

export function collectionStatusLabel(type: number): string {
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

export function subjectTypeLabel(type: number): string {
	switch (type) {
		case BANGUMI_SUBJECT_TYPES.book:
			return "book";
		case BANGUMI_SUBJECT_TYPES.anime:
			return "anime";
		case BANGUMI_SUBJECT_TYPES.music:
			return "music";
		case BANGUMI_SUBJECT_TYPES.game:
			return "game";
		case BANGUMI_SUBJECT_TYPES.real:
			return "real";
		default:
			return String(type);
	}
}
