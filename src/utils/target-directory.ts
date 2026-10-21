import { BANGUMI_STORAGE_LAYOUTS, BangumiStorageLayout } from "../settings";

export interface TargetDirectoryOptions {
	/** Root folder configured as the sync directory. */
	root: string;
	layout: BangumiStorageLayout;
}

/**
 * Build the folder that should hold a subject note.
 *
 * `subjectType` and `collectionStatus` are the very same label strings that are
 * written into the note frontmatter (`type` / `status`), so folders and
 * frontmatter can never drift apart.
 *
 * Every caller must go through this helper: the sync service writes notes here
 * and the progress board moves existing notes here, so the two must always agree
 * on the layout. Keep the switch in one place.
 */
export function buildTargetDirectory(
	{ root, layout }: TargetDirectoryOptions,
	subjectType: string,
	collectionStatus: string
): string {
	switch (layout) {
		case BANGUMI_STORAGE_LAYOUTS.subjectThenCollection:
			return `${root}/${subjectType}/${collectionStatus}`;
		case BANGUMI_STORAGE_LAYOUTS.collectionThenSubject:
			return `${root}/${collectionStatus}/${subjectType}`;
		case BANGUMI_STORAGE_LAYOUTS.flat:
		default:
			return root;
	}
}
