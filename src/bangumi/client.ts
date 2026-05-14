import { requestUrl } from "obsidian";

import {
	BangumiCollection,
	BangumiCollectionType,
	BangumiEpisodeCollection,
	BangumiPagedResponse,
	BangumiUser
} from "./types";
import { t } from "../i18n";

export interface BangumiClientOptions {
	accessToken: string;
	userAgent: string;
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

	async getSubjectEpisodeCollections(
		subjectId: number
	): Promise<BangumiPagedResponse<BangumiEpisodeCollection>> {
		return this.request<BangumiPagedResponse<BangumiEpisodeCollection>>(
			`/v0/users/-/collections/${subjectId}/episodes`
		);
	}

	private async request<T>(path: string): Promise<T> {
		const response = await requestUrl({
			url: `${this.baseUrl}${path}`,
			method: "GET",
			headers: {
				Authorization: `Bearer ${this.options.accessToken}`,
				"User-Agent": this.options.userAgent
			}
		});

		if (response.status < 200 || response.status >= 300) {
			throw new Error(
				this.buildErrorMessage(response.status, path, response.text)
			);
		}

		return response.json as T;
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
