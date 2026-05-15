import { getLanguage } from "obsidian";

type LocaleKey = keyof typeof EN;

const EN = {
	accessToken: "Access token",
	accessTokenDesc:
		"Open the token page, copy the generated token, then fill it from the clipboard. The saved field is hidden.",
	activeStatusRequired:
		"Select at least one active Bangumi collection status, or enable on hold/dropped syncing.",
	anime: "Anime",
	animeDesc: "Sync anime subjects.",
	apiForbidden:
		"Bangumi API forbidden ({{status}}). The access token may be missing permission for {{path}}.{{detail}}",
	apiNotFound:
		"Bangumi API resource not found ({{status}}) for {{path}}. Check the username or subject ID.{{detail}}",
	apiRateLimit:
		"Bangumi API rate limit reached ({{status}}). Wait a while before syncing again.{{detail}}",
	apiRequestFailed:
		"Bangumi API request failed ({{status}}) for {{path}}.{{detail}}",
	apiServerError:
		"Bangumi API server error ({{status}}). Try syncing again later.{{detail}}",
	apiUnauthorized:
		"Bangumi API unauthorized ({{status}}). Check whether the access token is valid or expired.{{detail}}",
	bangumiSync: "Bangumi Sync",
	books: "Books",
	booksDesc: "Sync book, manga, and related reading subjects.",
	byCollectionStatus: "By collection status",
	byCollectionStatusDesc:
		"Store notes under collection status folders, then subject type folders.",
	bySubjectType: "By subject type",
	bySubjectTypeDesc:
		"Store notes under subject type folders, then collection status folders.",
	clipboardTokenFailed: "Could not read the clipboard: {{message}}",
	clipboardTokenFilled: "Access token filled from clipboard.",
	clipboardTokenMissing: "Clipboard does not contain an access token.",
	copy: "Copy",
	copiedDailyNoteSyncBlock: "Daily Note sync block copied.",
	collected: "Collected",
	collectedDesc: "Sync subjects marked as watched.",
	collectionStatuses: "Collection statuses",
	collectionStatus: "Collection status",
	collectionStatusRequired:
		"Select at least one Bangumi collection status to sync.",
	collectionsFetched: "Collections fetched",
	commentJsonVar: "{{comment_json}}",
	connectedAs: "Connected as {{username}}.",
	dailyNoteSync: "Daily note sync",
	dailyNoteSyncDesc:
		"Add this block to your Daily Note template. In incremental sync, only newly written or updated in-progress subjects are added.",
	dailyNoteSyncBlock: "Daily Note sync block",
	dailyNoteSyncBlockDesc: "Copy this block into your Daily Note template.",
	dailyNoteSyncMarkersMissing:
		"Daily Note sync block markers were not found. Add the marker block to your Daily Note template first.",
	dailyNoteSyncNoteMissing:
		"Today's Daily Note was not found: {{path}}",
	dropped: "Dropped",
	droppedDesc: "Sync subjects marked as dropped.",
	error: "Error",
	fetchCollectionsStage: "fetch collections",
	fetchEpisodesStage: "fetch episodes",
	fetchedItems:
		"Fetched {{count}} {{subjectType}}/{{collectionStatus}} item(s).",
	fetchingCollections:
		"Fetching {{subjectType}}/{{collectionStatus}} collections...",
	fileNameFormat: "File name format",
	fillFromClipboard: "Fill from clipboard",
	game: "Games",
	gameDesc: "Sync game subjects.",
	idOnlyFormat: "Bangumi ID only",
	idOnlyFormatDesc: "Example: bgm-123.md",
	idTitleFormat: "[bgm-id] Title",
	idTitleFormatDesc: "Example: [bgm-123] Title.md",
	includeOnHoldDropped: "Include on hold/dropped",
	includeOnHoldDroppedDesc:
		"When disabled, on-hold and dropped collection statuses are skipped even if they are selected below.",
	incrementalSkipped: "Unchanged",
	incrementalSync: "Incremental sync",
	incrementalSyncDesc:
		"Skip unchanged items by Bangumi updated_at, but recreate missing local files when needed.",
	issues: "Issues",
	lastSyncedAt: "Last synced at",
	music: "Music",
	musicDesc: "Sync music subjects.",
	neverSynced: "Never synced successfully.",
	noCategories: "No categories",
	noCategoriesDesc: "Store all synced notes directly in the sync directory.",
	noToken: "Add a Bangumi access token in plugin settings first.",
	noteTemplate: "Note template",
	notesSynced: "Notes synced",
	onHold: "On hold",
	onHoldDesc: "Sync subjects marked as on hold.",
	openTokenPage: "Open token page",
	progressStarted: "Bangumi Sync started.",
	progressUnavailableReport: "Progress content was not fetched",
	realLife: "Real life",
	realLifeDesc: "Sync real-life media subjects.",
	reportCreated: " Report created.",
	reportFailures: "Failures",
	reportStage: "Stage",
	reportTitle: "Bangumi Sync Report",
	reportWriting: "Writing Bangumi sync failure report...",
	reset: "Reset",
	resetSubjectNoteTemplate: "Reset subject note template",
	resetSubjectNoteTemplateDesc: "Restore the built-in default Markdown template.",
	resetSyncState: "Reset sync state",
	skipped: "Skipped",
	storageLayout: "Storage layout",
	subjectId: "Subject ID",
	subjectNoteTemplate: "Subject note template",
	subjectNoteTemplateDesc:
		"Must include {{sync_block_start}} and {{sync_block_end}}. See the template variable documentation for all available variables.",
	templateVariablesDoc: "Template variables",
	templateVariablesDocDesc: "Open the documentation for available template variables.",
	templateVariablesDocFailed:
		"Could not open template variable documentation: {{message}}",
	testToken: "Test token",
	testTokenFailed: "Token test failed: {{message}}",
	testTokenSucceeded: "Token is valid. Connected as {{username}}.",
	subjectType: "Subject type",
	subjectTypeRequired: "Select at least one Bangumi subject type to sync.",
	subjectTypes: "Subject types",
	syncDirectory: "Sync directory",
	syncDirectoryDesc: "Notes will be created under this folder.",
	syncFailed: "Bangumi Sync failed: {{message}}",
	syncFinished:
		"Bangumi Sync finished for {{username}}: {{written}} note(s) synced, {{skipped}} skipped, {{incrementalSkipped}} unchanged, {{failed}} issue(s).{{reportCreated}}",
	syncGroupProgress:
		"{{subjectType}}/{{collectionStatus}} {{current}}/{{total}}: {{written}} synced, {{unchanged}} unchanged, {{skipped}} skipped.",
	syncNow: "Sync now",
	syncOneSubject: "Sync one subject",
	syncOneSubjectCancelled: "Single subject sync cancelled.",
	syncOneSubjectChoosePlaceholder: "Choose a Bangumi subject",
	syncOneSubjectDirectOption: "Sync bgm-{{id}} directly",
	syncOneSubjectFailed: "Single subject sync failed: {{message}}",
	syncOneSubjectInput: "Subject",
	syncOneSubjectInputDesc:
		"Enter a Bangumi URL, subject ID, Chinese title, original title, or title keyword.",
	syncOneSubjectInputPlaceholder: "Subject URL, ID, or title keyword",
	syncOneSubjectInputRequired: "Enter a subject URL, ID, or title keyword.",
	syncOneSubjectNoResults: "No Bangumi subjects found for: {{query}}",
	syncOneSubjectProgressMissing: "Progress content was not fetched.",
	syncOneSubjectStarted: "Syncing {{title}}...",
	syncOneSubjectStatusOption: "{{status}} for {{title}}",
	syncOneSubjectStatusPlaceholder:
		"This subject is not in your collection. Choose a local status.",
	syncOneSubjectUnchanged: "{{title}} is unchanged: {{path}}",
	syncOneSubjectUpdated: "{{title}} synced: {{path}}",
	syncRibbon: "Sync Bangumi",
	syncedAt: "Synced at",
	titleIdFormat: "Title [bgm-id]",
	titleIdFormatDesc: "Example: Title [bgm-123].md",
	tokenPageOpened: "Bangumi access token page opened.",
	unknownError: "Unknown Bangumi sync error",
	user: "User",
	username: "Username",
	usernameDesc: "Optional. If empty, the plugin will use /v0/me when syncing.",
	watching: "Watching",
	watchingDesc: "Sync subjects currently in progress.",
	wish: "Wish",
	wishDesc: "Sync subjects marked as want to watch.",
	writeNoteStage: "write note",
	writeDailyNoteStage: "write daily note sync block",
	writingItem: "Writing {{current}}/{{total}}: {{title}}"
} as const;

const ZH: Record<LocaleKey, string> = {
	accessToken: "Access token",
	accessTokenDesc:
		"打开 token 获取页面，复制生成的 token 后，从剪贴板填入。保存后的字段会隐藏显示。",
	activeStatusRequired:
		"请选择至少一个有效收藏状态，或开启搁置/抛弃同步。",
	anime: "动画",
	animeDesc: "同步动画条目。",
	apiForbidden:
		"Bangumi API 拒绝访问（{{status}}）。access token 可能缺少 {{path}} 所需权限。{{detail}}",
	apiNotFound:
		"Bangumi API 资源不存在（{{status}}）：{{path}}。请检查用户名或条目 ID。{{detail}}",
	apiRateLimit:
		"Bangumi API 触发限流（{{status}}）。请稍后再同步。{{detail}}",
	apiRequestFailed: "Bangumi API 请求失败（{{status}}）：{{path}}。{{detail}}",
	apiServerError:
		"Bangumi API 服务端错误（{{status}}）。请稍后再试。{{detail}}",
	apiUnauthorized:
		"Bangumi API 未授权（{{status}}）。请检查 access token 是否有效或已过期。{{detail}}",
	bangumiSync: "Bangumi Sync",
	books: "书籍",
	booksDesc: "同步书籍、漫画及相关阅读条目。",
	byCollectionStatus: "按收藏状态分类",
	byCollectionStatusDesc:
		"先按收藏状态分文件夹，再按条目类型分子文件夹。",
	bySubjectType: "按条目类型分类",
	bySubjectTypeDesc:
		"先按条目类型分文件夹，再按收藏状态分子文件夹。",
	clipboardTokenFailed: "无法读取剪贴板：{{message}}",
	clipboardTokenFilled: "已从剪贴板填入 access token。",
	clipboardTokenMissing: "剪贴板里没有 access token。",
	copy: "复制",
	copiedDailyNoteSyncBlock: "已复制每日日记同步块。",
	collected: "已收藏",
	collectedDesc: "同步标记为已看/已读/已完成的条目。",
	collectionStatuses: "收藏状态",
	collectionStatus: "收藏状态",
	collectionStatusRequired: "请选择至少一个要同步的 Bangumi 收藏状态。",
	collectionsFetched: "已拉取收藏数",
	commentJsonVar: "{{comment_json}}",
	connectedAs: "已连接为 {{username}}。",
	dailyNoteSync: "每日日记同步",
	dailyNoteSyncDesc:
		"请先把下面的同步块放进你的每日日记模板。增量同步时，只会添加本次实际新增或更新的进行中条目。",
	dailyNoteSyncBlock: "每日日记同步块",
	dailyNoteSyncBlockDesc: "复制这段同步块到你的每日日记模板里。",
	dailyNoteSyncMarkersMissing:
		"没有找到每日日记同步块标记。请先把同步块放进你的每日日记模板。",
	dailyNoteSyncNoteMissing:
		"没有找到今天的每日日记：{{path}}",
	dropped: "已抛弃",
	droppedDesc: "同步标记为抛弃的条目。",
	error: "错误",
	fetchCollectionsStage: "拉取收藏",
	fetchEpisodesStage: "拉取章节进度",
	fetchedItems:
		"已拉取 {{count}} 个 {{subjectType}}/{{collectionStatus}} 条目。",
	fetchingCollections:
		"正在拉取 {{subjectType}}/{{collectionStatus}} 收藏...",
	fileNameFormat: "文件命名格式",
	fillFromClipboard: "从剪贴板填入",
	game: "游戏",
	gameDesc: "同步游戏条目。",
	idOnlyFormat: "仅 Bangumi ID",
	idOnlyFormatDesc: "示例：bgm-123.md",
	idTitleFormat: "[bgm-id] 标题",
	idTitleFormatDesc: "示例：[bgm-123] Title.md",
	includeOnHoldDropped: "包含搁置/抛弃",
	includeOnHoldDroppedDesc:
		"关闭时，即使下方选中了搁置或抛弃状态，同步时也会跳过。",
	incrementalSkipped: "未变化",
	incrementalSync: "增量同步",
	incrementalSyncDesc:
		"根据 Bangumi 更新时间跳过未变化条目，但会在本地文件缺失时重新创建。",
	issues: "问题数",
	lastSyncedAt: "上次同步时间",
	music: "音乐",
	musicDesc: "同步音乐条目。",
	neverSynced: "尚未成功同步。",
	noCategories: "不分类",
	noCategoriesDesc: "所有同步笔记都直接存放在同步目录下。",
	noToken: "请先在插件设置中填写 Bangumi access token。",
	noteTemplate: "笔记模板",
	notesSynced: "已同步笔记数",
	onHold: "搁置",
	onHoldDesc: "同步标记为搁置的条目。",
	openTokenPage: "打开 token 页面",
	progressStarted: "Bangumi Sync 已开始。",
	progressUnavailableReport: "没拉到进度内容",
	realLife: "三次元",
	realLifeDesc: "同步三次元条目。",
	reportCreated: " 已生成报告。",
	reportFailures: "失败详情",
	reportStage: "阶段",
	reportTitle: "Bangumi 同步报告",
	reportWriting: "正在写入 Bangumi 同步失败报告...",
	reset: "重置",
	resetSubjectNoteTemplate: "重置条目笔记模板",
	resetSubjectNoteTemplateDesc: "恢复内置默认 Markdown 模板。",
	resetSyncState: "重置同步状态",
	skipped: "已跳过",
	storageLayout: "存储逻辑",
	subjectId: "条目 ID",
	subjectNoteTemplate: "条目笔记模板",
	subjectNoteTemplateDesc:
		"必须包含 {{sync_block_start}} 和 {{sync_block_end}}。所有可用变量请查看模板变量文档。",
	templateVariablesDoc: "模板变量文档",
	templateVariablesDocDesc: "打开可用模板变量说明文档。",
	templateVariablesDocFailed: "无法打开模板变量文档：{{message}}",
	testToken: "测试 token",
	testTokenFailed: "Token 测试失败：{{message}}",
	testTokenSucceeded: "Token 有效，已连接为 {{username}}。",
	subjectType: "条目类型",
	subjectTypeRequired: "请选择至少一个要同步的 Bangumi 条目类型。",
	subjectTypes: "条目类型",
	syncDirectory: "同步目录",
	syncDirectoryDesc: "笔记会创建在这个文件夹下。",
	syncFailed: "Bangumi Sync 失败：{{message}}",
	syncFinished:
		"Bangumi Sync 完成：用户 {{username}}，同步 {{written}} 条，跳过 {{skipped}} 条，未变化 {{incrementalSkipped}} 条，问题 {{failed}} 个。{{reportCreated}}",
	syncGroupProgress:
		"{{subjectType}}/{{collectionStatus}} {{current}}/{{total}}：同步 {{written}} 条，未变化 {{unchanged}} 条，跳过 {{skipped}} 条。",
	syncNow: "立即同步",
	syncOneSubject: "单独同步条目",
	syncOneSubjectCancelled: "已取消单独同步。",
	syncOneSubjectChoosePlaceholder: "选择一个 Bangumi 条目",
	syncOneSubjectDirectOption: "直接同步 bgm-{{id}}",
	syncOneSubjectFailed: "单独同步失败：{{message}}",
	syncOneSubjectInput: "条目",
	syncOneSubjectInputDesc:
		"输入 Bangumi 网址、条目 ID、中文名、原名或标题关键词。",
	syncOneSubjectInputPlaceholder: "条目网址、ID 或标题关键词",
	syncOneSubjectInputRequired: "请输入条目网址、ID 或标题关键词。",
	syncOneSubjectNoResults: "没有找到相关 Bangumi 条目：{{query}}",
	syncOneSubjectProgressMissing: "没有拉到进度内容。",
	syncOneSubjectStarted: "正在同步 {{title}}...",
	syncOneSubjectStatusOption: "{{title}}：{{status}}",
	syncOneSubjectStatusPlaceholder:
		"这个条目不在你的收藏里，请选择一个本地状态。",
	syncOneSubjectUnchanged: "{{title}} 没有变化：{{path}}",
	syncOneSubjectUpdated: "{{title}} 已同步：{{path}}",
	syncRibbon: "同步 Bangumi",
	syncedAt: "同步时间",
	titleIdFormat: "标题 [bgm-id]",
	titleIdFormatDesc: "示例：Title [bgm-123].md",
	tokenPageOpened: "已打开 Bangumi access token 页面。",
	unknownError: "未知 Bangumi 同步错误",
	user: "用户",
	username: "Username",
	usernameDesc: "可选。留空时，插件会在同步时使用 /v0/me。",
	watching: "进行中",
	watchingDesc: "同步当前正在看/读/玩的条目。",
	wish: "想看/想读",
	wishDesc: "同步标记为想看/想读的条目。",
	writeNoteStage: "写入笔记",
	writeDailyNoteStage: "写入每日日记同步块",
	writingItem: "正在写入 {{current}}/{{total}}：{{title}}"
};

export function isChineseLocale(): boolean {
	return getLanguage().toLowerCase().startsWith("zh");
}

export function t(
	key: LocaleKey,
	values: Record<string, string | number | undefined> = {}
): string {
	const table = isChineseLocale() ? ZH : EN;
	return table[key].replace(
		/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
		(match: string, name: string) => {
			const value = values[name];
			return value === undefined ? match : String(value);
		}
	);
}
