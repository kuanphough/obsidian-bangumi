export const BANGUMI_COLLECTION_TYPES = {
	wish: 1,
	collect: 2,
	do: 3,
	onHold: 4,
	dropped: 5
} as const;

export type BangumiCollectionType =
	(typeof BANGUMI_COLLECTION_TYPES)[keyof typeof BANGUMI_COLLECTION_TYPES];

export interface BangumiUser {
	id: number;
	username: string;
	nickname: string;
}

export interface BangumiImages {
	large?: string;
	common?: string;
	medium?: string;
	small?: string;
	grid?: string;
}

export interface BangumiSubject {
	id: number;
	type: number;
	name: string;
	name_cn?: string;
	summary?: string;
	images?: BangumiImages;
	eps?: number;
	date?: string;
	rating?: {
		score?: number;
		total?: number;
	};
	collection?: {
		doing?: number;
		collect?: number;
		wish?: number;
		on_hold?: number;
		dropped?: number;
	};
}

export interface BangumiCollection {
	type: BangumiCollectionType;
	rate?: number;
	comment?: string;
	tags?: string[];
	updated_at?: string;
	subject: BangumiSubject;
}

export interface BangumiPagedResponse<T> {
	total: number;
	limit: number;
	offset: number;
	data: T[];
}

export interface BangumiEpisode {
	id: number;
	type: number;
	sort: number;
	name?: string;
	name_cn?: string;
	airdate?: string;
}

export interface BangumiEpisodeCollection {
	episode: BangumiEpisode;
	type: number;
}

export interface BangumiSyncedSubject {
	collection: BangumiCollection;
	episodes: BangumiEpisodeCollection[];
}
