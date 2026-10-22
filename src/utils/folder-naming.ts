/**
 * Folder names for the "subject type / collection status" storage layouts.
 *
 * The note frontmatter always keeps the English codes (`type: anime`,
 * `status: do`) because the index, the board and write-back match on them.
 * Only the folder path is translated here, so these two concerns stay separate
 * and a naming change can never corrupt existing notes.
 *
 * Chinese names follow Bangumi's own wording, which differs per subject type:
 * books use 想读/读过/在读, music uses 想听/听过/在听, everything else uses
 * 想看/看过/在看. 搁置 and 抛弃 are shared.
 */
export const FOLDER_NAMINGS = {
	english: "english",
	chinese: "chinese"
} as const;

export type FolderNaming =
	(typeof FOLDER_NAMINGS)[keyof typeof FOLDER_NAMINGS];

export const FOLDER_NAMING_VALUES: readonly string[] = [
	FOLDER_NAMINGS.english,
	FOLDER_NAMINGS.chinese
];

export function isFolderNaming(value: unknown): value is FolderNaming {
	return typeof value === "string" && FOLDER_NAMING_VALUES.includes(value);
}

/** English codes returned by subjectTypeLabel(), in Bangumi's type order. */
export const SUBJECT_FOLDER_KEYS: readonly string[] = [
	"book",
	"anime",
	"music",
	"game",
	"real"
];

/** English codes returned by collectionStatusLabel(). */
export const STATUS_FOLDER_KEYS: readonly string[] = [
	"wish",
	"collect",
	"do",
	"on_hold",
	"dropped"
];

const SUBJECT_NAMES_ZH: Record<string, string> = {
	book: "书籍",
	anime: "动画",
	music: "音乐",
	game: "游戏",
	real: "三次元"
};

type SubjectGroup = "book" | "music" | "other";

const STATUS_NAMES_ZH: Record<SubjectGroup, Record<string, string>> = {
	book: {
		wish: "想读",
		collect: "读过",
		do: "在读",
		on_hold: "搁置",
		dropped: "抛弃"
	},
	music: {
		wish: "想听",
		collect: "听过",
		do: "在听",
		on_hold: "搁置",
		dropped: "抛弃"
	},
	other: {
		wish: "想看",
		collect: "看过",
		do: "在看",
		on_hold: "搁置",
		dropped: "抛弃"
	}
};

function subjectGroup(subjectType: string): SubjectGroup {
	if (subjectType === "book") return "book";
	if (subjectType === "music") return "music";
	return "other";
}

/** Folder segment for a subject type. Unknown values pass through unchanged. */
export function subjectFolderName(
	subjectType: string,
	naming: FolderNaming
): string {
	// Anything other than Chinese falls back to the English codes, so a missing
	// or corrupt setting can never silently rename folders.
	if (naming !== FOLDER_NAMINGS.chinese) return subjectType;
	return SUBJECT_NAMES_ZH[subjectType] ?? subjectType;
}

/**
 * Folder segment for a collection status. The Chinese wording depends on the
 * subject type, so it must be passed in as well.
 */
export function statusFolderName(
	subjectType: string,
	collectionStatus: string,
	naming: FolderNaming
): string {
	if (naming !== FOLDER_NAMINGS.chinese) return collectionStatus;
	return (
		STATUS_NAMES_ZH[subjectGroup(subjectType)][collectionStatus] ??
		collectionStatus
	);
}
