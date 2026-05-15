import { requestUrl } from "obsidian";

import {
	BangumiCollection,
	BangumiCollectionType,
	BangumiEpisodeCollection,
	BangumiPagedResponse,
	BangumiSubject,
	BangumiSubjectSearchRequest,
	BangumiUser
} from "./types";
import { t } from "../i18n";

export interface BangumiClientOptions {
	accessToken: string;
	userAgent: string;
}

export class BangumiApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly path: string
	) {
		super(message);
		this.name = "BangumiApiError";
	}
}

interface LegacyBangumiSubject {
	id: number;
	type: number;
	name: string;
	name_cn?: string;
	summary?: string;
	images?: BangumiSubject["images"];
	eps?: number | unknown[];
	eps_count?: number;
	date?: string;
	air_date?: string;
	rating?: BangumiSubject["rating"];
	collection?: BangumiSubject["collection"];
}

export class BangumiClient {
	private readonly baseUrl = "https://api.bgm.tv";

	constructor(private readonly options: BangumiClientOptions) {}

	async getMe(): Promise<BangumiUser> {
		return this.request<BangumiUser>("/v0/me");
	}

	async getCollections(params: {
		username: string;
		subjectType: number;
		collectionType: BangumiCollectionType;
		limit?: number;
		offset?: number;
	}): Promise<BangumiPagedResponse<BangumiCollection>> {
		const search = new URLSearchParams({
			subject_type: String(params.subjectType),
			type: String(params.collectionType),
			limit: String(params.limit ?? 50),
			offset: String(params.offset ?? 0)
		});

		return this.request<BangumiPagedResponse<BangumiCollection>>(
			`/v0/users/${encodeURIComponent(params.username)}/collections?${search.toString()}`
		);
	}

	async getSubject(subjectId: number): Promise<BangumiSubject> {
		return this.request<BangumiSubject>(`/v0/subjects/${subjectId}`);
	}

	async getLegacySubject(subjectId: number): Promise<BangumiSubject> {
		const subject = await this.request<LegacyBangumiSubject>(
			`/subject/${subjectId}?responseGroup=large`
		);
		return this.normalizeLegacySubject(subject);
	}

	async getSubjectCollection(
		subjectId: number,
		username = "-"
	): Promise<BangumiCollection> {
		return this.request<BangumiCollection>(
			`/v0/users/${encodeURIComponent(username)}/collections/${subjectId}`
		);
	}

	async getSubjectEpisodeCollections(
		subjectId: number
	): Promise<BangumiPagedResponse<BangumiEpisodeCollection>> {
		return this.request<BangumiPagedResponse<BangumiEpisodeCollection>>(
			`/v0/users/-/collections/${subjectId}/episodes`
		);
	}

	async searchSubjects(
		params: BangumiSubjectSearchRequest
	): Promise<BangumiPagedResponse<BangumiSubject>> {
		const search = new URLSearchParams({
			limit: String(params.limit ?? 20),
			offset: String(params.offset ?? 0)
		});

		return this.request<BangumiPagedResponse<BangumiSubject>>(
			`/v0/search/subjects?${search.toString()}`,
			{
				method: "POST",
				body: {
					keyword: params.keyword,
					sort: params.sort ?? "match",
					filter: params.filter ?? {}
				}
			}
		);
	}

	private async request<T>(
		path: string,
		options: {
			method?: "GET" | "POST";
			body?: unknown;
		} = {}
	): Promise<T> {
		const response = await requestUrl({
			url: `${this.baseUrl}${path}`,
			method: options.method ?? "GET",
			headers: {
				Authorization: `Bearer ${this.options.accessToken}`,
				"User-Agent": this.options.userAgent,
				...(options.body === undefined
					? {}
					: { "Content-Type": "application/json" })
			},
			body:
				options.body === undefined ? undefined : JSON.stringify(options.body)
		});

		if (response.status < 200 || response.status >= 300) {
			throw new BangumiApiError(
				this.buildErrorMessage(response.status, path, response.text),
				response.status,
				path
			);
		}

		return response.json as T;
	}

	private normalizeLegacySubject(subject: LegacyBangumiSubject): BangumiSubject {
		const eps =
			typeof subject.eps === "number"
				? subject.eps
				: subject.eps_count ??
					(Array.isArray(subject.eps) ? subject.eps.length : undefined);

		return {
			id: subject.id,
			type: subject.type,
			name: subject.name,
			name_cn: subject.name_cn,
			summary: subject.summary,
			images: subject.images,
			eps,
			date: subject.date ?? subject.air_date,
			rating: subject.rating,
			collection: subject.collection
		};
	}

	private buildErrorMessage(status: number, path: string, detail: string): string {
		const detailText = detail.trim() ? ` Detail: ${detail.trim()}` : "";
		const values = {
			status,
			path,
			detail: detailText
		};

		switch (status) {
			case 401:
				return t("apiUnauthorized", values);
			case 403:
				return t("apiForbidden", values);
			case 404:
				return t("apiNotFound", values);
			case 429:
				return t("apiRateLimit", values);
			case 500:
			case 502:
			case 503:
			case 504:
				return t("apiServerError", values);
			default:
				return t("apiRequestFailed", values);
		}
	}
}
