import { App } from "obsidian";

import {
	BANGUMI_COLLECTION_TYPES,
	BANGUMI_SUBJECT_TYPES
} from "../bangumi/types";
import { collectionStatusLabel, subjectTypeLabel } from "../bangumi/labels";
import { t } from "../i18n";
import { getMarkdownFilesInFolder } from "../utils/vault";

/**
 * Detect local notes whose remote collection status no longer matches.
 *
 * `collectionTypes` only decides what gets pulled. When a subject is moved to a
 * status that is not selected, the plugin stops touching it and the local note
 * silently keeps showing the old status. This module finds those notes so the
 * user can be told, without pulling every unselected status.
 *
 * Two thirds of the cases need no API call: the note frontmatter already holds
 * the English `type` / `status` codes, so a note outside the configured scope is
 * known immediately. Only a note that *should* have been synced but didn't come
 * back needs one request to learn its real remote status.
 */

export interface LocalNoteStatus {
	path: string;
	subjectId: number;
	/** English subject type code from frontmatter (`anime`, `real`, ...). */
	subjectType: string;
	/** English collection status code from frontmatter (`do`, `collect`, ...). */
	status: string;
	title: string;
}

export interface StatusScope {
	subjectTypes: readonly number[];
	collectionStatuses: readonly number[];
}

export interface StatusDriftPartition {
	inScope: LocalNoteStatus[];
	outOfScope: LocalNoteStatus[];
}

export interface StatusDriftEntry {
	path: string;
	subjectId: number;
	title: string;
	localStatus: string;
	/** Remote status code, or null when the subject is no longer collected. */
	remoteStatus: string | null;
}

export interface StatusDriftSummary {
	/** Local notes the plugin already updated to match Bangumi. */
	updated: StatusDriftEntry[];
	/** Local notes whose subject is no longer collected remotely. */
	uncollected: StatusDriftEntry[];
	/** Local notes excluded by the current subject type selection. */
	outOfScope: number;
	/** Notes that could not be verified or rewritten. */
	failed: number;
	/** True when not every drifted note could be handled within the cap. */
	truncated: boolean;
}

/** Upper bound on verification requests per sync run. */
export const STATUS_DRIFT_MAX_REMOTE_CHECKS = 30;
const NOTICE_MAX_ITEMS = 3;

/** Read `bangumi_id` / `type` / `status` from every note in the sync directory. */
export function readLocalNoteStatuses(
	app: App,
	syncDirectory: string
): LocalNoteStatus[] {
	const notes: LocalNoteStatus[] = [];

	for (const file of getMarkdownFilesInFolder(app, syncDirectory)) {
		const cache = app.metadataCache.getFileCache(file);
		const raw: unknown = cache?.frontmatter;
		if (typeof raw !== "object" || raw === null) continue;
		const frontmatter = raw as Record<string, unknown>;

		const subjectId = frontmatter.bangumi_id;
		const subjectType = frontmatter.type;
		const status = frontmatter.status;
		if (
			typeof subjectId !== "number" ||
			typeof subjectType !== "string" ||
			typeof status !== "string"
		) {
			continue;
		}

		const title =
			typeof frontmatter.title === "string" && frontmatter.title.length > 0
				? frontmatter.title
				: file.basename;
		notes.push({ path: file.path, subjectId, subjectType, status, title });
	}

	return notes;
}

/**
 * Split local notes into what this run should cover and what the current
 * settings deliberately exclude. Pure so it can be tested without a vault.
 */
export function partitionLocalNotes(
	notes: readonly LocalNoteStatus[],
	scope: StatusScope
): StatusDriftPartition {
	const types = new Set(scope.subjectTypes.map((type) => subjectTypeLabel(type)));
	const statuses = new Set(
		scope.collectionStatuses.map((status) => collectionStatusLabel(status))
	);

	const inScope: LocalNoteStatus[] = [];
	const outOfScope: LocalNoteStatus[] = [];

	for (const note of notes) {
		if (types.has(note.subjectType) && statuses.has(note.status)) {
			inScope.push(note);
		} else {
			outOfScope.push(note);
		}
	}

	return { inScope, outOfScope };
}

function statusDisplayName(code: string): string {
	switch (code) {
		case collectionStatusLabel(BANGUMI_COLLECTION_TYPES.wish):
			return t("wish");
		case collectionStatusLabel(BANGUMI_COLLECTION_TYPES.collect):
			return t("collected");
		case collectionStatusLabel(BANGUMI_COLLECTION_TYPES.do):
			return t("watching");
		case collectionStatusLabel(BANGUMI_COLLECTION_TYPES.onHold):
			return t("onHold");
		case collectionStatusLabel(BANGUMI_COLLECTION_TYPES.dropped):
			return t("dropped");
		default:
			return code;
	}
}

export function formatStatusDriftNotice(summary: StatusDriftSummary): string {
	const parts: string[] = [];

	if (summary.updated.length > 0) {
		const items = summary.updated
			.slice(0, NOTICE_MAX_ITEMS)
			.map((entry) =>
				entry.remoteStatus === null
					? entry.title
					: t("statusDriftItem", {
							title: entry.title,
							from: statusDisplayName(entry.localStatus),
							to: statusDisplayName(entry.remoteStatus)
						})
			)
			.join(t("statusDriftSeparator"));
		const rest = summary.updated.length - NOTICE_MAX_ITEMS;
		parts.push(
			rest > 0
				? t("statusDriftUpdatedMore", {
						count: summary.updated.length,
						items,
						rest
					})
				: t("statusDriftUpdated", {
						count: summary.updated.length,
						items
					})
		);
	}

	if (summary.uncollected.length > 0) {
		const items = summary.uncollected
			.slice(0, NOTICE_MAX_ITEMS)
			.map((entry) => entry.title)
			.join(t("statusDriftSeparator"));
		parts.push(
			t("statusDriftUncollected", { count: summary.uncollected.length, items })
		);
	}

	if (summary.outOfScope > 0) {
		parts.push(t("statusDriftOutOfScope", { count: summary.outOfScope }));
	}

	if (summary.failed > 0) {
		parts.push(t("statusDriftFailed", { count: summary.failed }));
	}

	return parts.join(" ");
}

/** Subject type codes exist for completeness of the summary shape. */
export const KNOWN_SUBJECT_TYPE_CODES: readonly string[] = [
	subjectTypeLabel(BANGUMI_SUBJECT_TYPES.book),
	subjectTypeLabel(BANGUMI_SUBJECT_TYPES.anime),
	subjectTypeLabel(BANGUMI_SUBJECT_TYPES.music),
	subjectTypeLabel(BANGUMI_SUBJECT_TYPES.game),
	subjectTypeLabel(BANGUMI_SUBJECT_TYPES.real)
];
