import { BANGUMI_STORAGE_LAYOUTS, BangumiStorageLayout } from "../settings";
import {
	FolderNaming,
	statusFolderName,
	subjectFolderName
} from "./folder-naming";

export interface TargetDirectoryOptions {
	/** Root folder configured as the sync directory. */
	root: string;
	layout: BangumiStorageLayout;
	/** Language used for the folder segments, independent of the frontmatter. */
	naming: FolderNaming;
}

/**
 * Build the folder that should hold a subject note.
 *
 * `subjectType` and `collectionStatus` are the English codes written into the
 * note frontmatter (`type` / `status`). They are only translated for the path,
 * so a naming change never touches the notes themselves.
 *
 * Every caller must go through this helper: the sync service writes notes here,
 * the progress board moves existing notes here, and the folder migration uses
 * it to compute both the old and the new location. Keep the switch in one place.
 */
export function buildTargetDirectory(
	{ root, layout, naming }: TargetDirectoryOptions,
	subjectType: string,
	collectionStatus: string
): string {
	const type = subjectFolderName(subjectType, naming);
	const status = statusFolderName(subjectType, collectionStatus, naming);

	switch (layout) {
		case BANGUMI_STORAGE_LAYOUTS.subjectThenCollection:
			return `${root}/${type}/${status}`;
		case BANGUMI_STORAGE_LAYOUTS.collectionThenSubject:
			return `${root}/${status}/${type}`;
		case BANGUMI_STORAGE_LAYOUTS.flat:
		default:
			return root;
	}
}
