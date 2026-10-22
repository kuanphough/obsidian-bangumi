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
	boardBackToList: "Back to list",
	boardChangeSummary: "Will mark done: {{done}}, mark undone: {{undone}}.",
	boardComment: "Comment",
	boardDesc: "Manage in-progress Bangumi subjects from synced notes.",
	boardDiscardChanges: "Discard changes",
	boardEmpty: "No in-progress Bangumi notes found in the sync directory.",
	boardEmptyValue: "(empty)",
	boardFilterEmpty: "No in-progress subjects match this type filter.",
	boardLoadFailed: "Could not load board item: {{message}}",
	boardLoading: "Loading episode progress...",
	boardNoEpisodes: "No episode progress data available.",
	boardProgress: "{{done}}/{{total}}",
	boardPushChanges: "Push changes",
	boardPushFinished:
		"Bangumi board write-back finished: {{episodes}} episode change(s). Local Markdown checklist updated.",
	boardPushUnsupported:
		"Episode write-back from the board only supports remote status do or collect.",
	boardRating: "Rating",
	boardRatingNone: "N/A",
	boardRefreshItem: "Refresh item",
	boardRefreshList: "Refresh list",
	boardStatus: "Status",
	boardStatusCommentDesc:
		"This comment and rating will be saved to your Bangumi collection together with the status change.",
	boardStatusCommentTitle: "Comment for {{status}}",
	boardStatusDesc: "Changing status writes to Bangumi after you confirm a comment.",
	boardStatusFinished: "Bangumi status changed to {{status}}.",
	boardStatusStarted: "Writing Bangumi status...",
	boardTitle: "Bangumi Board",
	boardTypeAll: "All types",
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
	dailyNoteFolder: "Daily note folder",
	dailyNoteFolderDesc:
		"Folder that holds your daily notes. Leave empty to use the Daily Notes core plugin setting. Fill this in if you create daily notes with QuickAdd, Periodic Notes, or another method.",
	dailyNoteFormat: "Daily note date format",
	dailyNoteFormatDesc:
		"Moment.js date format used for the daily note file name. Leave empty to use the Daily Notes core plugin setting, falling back to YYYY-MM-DD.",
	dailyNoteSyncBlock: "Daily Note sync block",
	dailyNoteSyncBlockDesc: "Copy this block into your Daily Note template.",
	dailyNoteSyncMarkersMissing:
		"Daily Note sync block markers were not found. Add the marker block to your Daily Note template first.",
	dailyNoteSyncNoteMissing:
		"Today's Daily Note was not found: {{path}}",
	dropped: "Dropped",
	droppedDesc: "Sync subjects marked as dropped.",
	enableWriteBack: "Enable write-back to Bangumi",
	enableWriteBackDesc:
		"Allow explicit pushes from the current note to Bangumi. This can modify your Bangumi account data; each push still requires confirmation.",
	error: "Error",
	fetchCollectionsStage: "fetch collections",
	fetchEpisodesStage: "fetch episodes",
	fetchedItems:
		"Fetched {{count}} {{subjectType}}/{{collectionStatus}} item(s).",
	fetchingCollections:
		"Fetching {{subjectType}}/{{collectionStatus}} collections...",
	fetchCharacters: "Fetch characters",
	fetchCharactersDesc:
		"Expose subject characters as template variables. Adds one extra API request per subject.",
	fileNameFormat: "File name format",
	fetchDetailedSubjectInfo: "Fetch detailed subject info",
	fetchDetailedSubjectInfoDesc:
		"Expose platform, volumes, total episodes, summary, infobox, public tags, public rating, and collection stats as template variables.",
	fetchRelations: "Fetch relations",
	fetchRelationsDesc:
		"Expose related subjects as template variables. Adds one extra API request per subject.",
	fetchStaff: "Fetch staff",
	fetchStaffDesc:
		"Expose subject staff/persons as template variables. Adds one extra API request per subject.",
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
	syncConcurrency: "Sync concurrency",
	syncConcurrencyDesc:
		"How many subjects to fetch in parallel. Higher is faster but more likely to hit Bangumi rate limits. Default 4.",
	dnsFix: "DNS fix (DoH)",
	dnsFixDesc:
		"Choose how api.bgm.tv is resolved. Auto tries the normal network path first and only switches to DNS-over-HTTPS after a network failure, so users behind a proxy or a normal DNS are unaffected. Always resolves through DoH up front, which skips the first timeout if your system DNS is poisoned. Off keeps the plugin on Obsidian's default transport. Desktop only, and the access token is never sent to the resolver.",
	dnsFixAuto: "Auto (recommended)",
	dnsFixAlways: "Always use DoH",
	dnsFixOff: "Off",
	dnsFixMobileDesc:
		"Not available on mobile: the built-in DNS-over-HTTPS transport needs a desktop runtime. If syncing fails with network errors on mobile, turn on encrypted DNS at the OS level instead - on Android set Private DNS to dns.alidns.com, on iOS install a DoH/DoT configuration profile.",
	coversLocalized: "Localized covers for {{count}} note(s).",
	localizeCovers: "Localize cover images",
	localizeCoversDesc:
		"Download covers into the vault and link them locally instead of pointing at the remote URL. Off by default, because it stores extra files in your vault; enable it only when remote covers do not load, for example when the system DNS cannot resolve lain.bgm.tv. Images go into a covers folder inside the sync directory.",
	statusDriftItem: "{{title}} ({{from}} -> {{to}})",
	statusDriftSeparator: "; ",
	statusDriftUpdated:
		"Updated {{count}} note(s) to match Bangumi: {{items}}",
	statusDriftUpdatedMore:
		"Updated {{count}} note(s) to match Bangumi: {{items}} and {{rest}} more",
	statusDriftUncollected:
		"{{count}} note(s) are no longer in your Bangumi collection: {{items}}",
	statusDriftOutOfScope:
		"Another {{count}} local note(s) are outside the current sync scope (subject type not selected).",
	statusDriftFailed:
		"{{count}} note(s) could not be checked; see the console log for details.",
	folderNaming: "Folder naming",
	folderNamingDesc:
		"Language used for the classification folder names. Note frontmatter always keeps the English codes (type / status), so switching this never rewrites existing notes. Use the migrate button below to move notes into the new folders.",
	folderNamingEnglish: "English (anime / do)",
	folderNamingChinese: "Chinese (Bangumi wording)",
	migrateFolders: "Migrate classification folders",
	migrateFoldersDesc:
		"Move notes from the previous folder naming to the current one. A preview is shown first, and notes whose target path already exists are skipped.",
	migrateFoldersButton: "Preview and migrate",
	migrateFoldersTitle: "Migrate classification folders",
	migrateFoldersIntro:
		"{{moves}} notes will move to the current naming. {{conflicts}} notes will be skipped because the target path already exists.",
	migrateFoldersMore: "... and {{count}} more",
	migrateFoldersConflictNote:
		"These notes already exist at the target path and will be left where they are:",
	migrateFoldersNothing: "No folders need migrating.",
	migrateFoldersRunning: "Migrating classification folders...",
	migrateFoldersDone:
		"Migration finished: {{moved}} notes moved, {{conflicts}} skipped.",
	migrateFoldersFailed: "Folder migration failed: {{message}}",
	migrateFoldersConfirm: "Migrate",
	migrateFoldersCancel: "Cancel",
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
	enableOnAirNote: "Enable On Air note",
	enableOnAirNoteDesc:
		"Generate Bangumi/On Air.md after sync. It shows this week's anime broadcasts filtered to your wish and watching collections.",
	onAirNoteFailed: "On Air note update failed: {{message}}",
	onAirNoteUnchanged: "On Air note is unchanged: {{path}}",
	onAirNoteUpdated: "On Air note updated: {{path}}",
	openBoard: "Open Bangumi board",
	openTokenPage: "Open token page",
	progressStarted: "Bangumi Sync started.",
	progressUnavailableReport: "Progress content was not fetched",
	pushCancel: "Cancel",
	pushCancelled: "Bangumi write-back cancelled.",
	pushChecklistMissing:
		"No writable episode checklist found. Re-sync this note first to generate bgm-ep markers.",
	pushConfirm: "Push",
	pushConfirmDesc:
		"Review the changes below. This will modify your Bangumi account.",
	pushConfirmTitle: "Confirm Bangumi write-back",
	pushCurrentNote: "Push current note to Bangumi",
	pushFailed: "Bangumi write-back failed: {{message}}",
	pushEpisodeVerifyFailed:
		"Bangumi did not confirm these episode changes after write-back: {{ids}}. Try pushing again later.",
	pushFinished:
		"Bangumi write-back finished: {{episodes}} episode change(s), final status: {{finalStatus}}.{{moved}}{{resync}}",
	pushFinishedResync:
		" Bangumi changed the final status after the episode update; re-sync this note to refresh local metadata.",
	pushInvalidNote: "Current note is not a valid Bangumi subject note.",
	pushMoved: " Moved note to {{path}}.",
	pushMoveTargetExists:
		"Write-back succeeded, but the note could not be moved because the target file already exists: {{path}}",
	pushNoActiveFile: "Open a Bangumi subject note before pushing.",
	pushNoChanges: "No Bangumi write-back changes detected.",
	pushStarted: "Pushing current note to Bangumi...",
	pushStatusUnsupported:
		"Write-back only supports notes whose status is wish, do, collect, on_hold, or dropped.",
	pushStatusVerifyFailed:
		"Bangumi did not confirm the status change. Expected {{expected}}, actual {{actual}}.",
	pushUnknownEpisodes:
		"Some bgm-ep markers do not belong to this subject. Re-sync this note before pushing: {{ids}}",
	pushWriteBackDisabled:
		"Enable write-back to Bangumi in plugin settings first.",
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
	testTokenFailedMobileNetwork:
		"Token test failed: {{message}}. The built-in DNS fix only works on desktop, so if this is a network error, turn on encrypted DNS in your system settings (Android: Private DNS to dns.alidns.com; iOS: install a DoH/DoT profile).",
	testTokenSucceeded: "Token is valid. Connected as {{username}}.",
	updateOnAirNote: "Update On Air note",
	subjectType: "Subject type",
	subjectTypeRequired: "Select at least one Bangumi subject type to sync.",
	subjectTypes: "Subject types",
	templateDataSources: "Template data toggles",
	templateDataSourcesDesc:
		"Variables used in your template are fetched automatically. Enable these to force extra data fetching; this adds API requests and may make sync slower.",
	syncDirectory: "Sync directory",
	syncDirectoryDesc: "Notes will be created under this folder.",
	syncFailed: "Bangumi Sync failed: {{message}}",
	syncFailedMobileNetwork:
		"Bangumi Sync failed: {{message}}. The built-in DNS fix only works on desktop, so if this is a network error, turn on encrypted DNS in your system settings (Android: Private DNS to dns.alidns.com; iOS: install a DoH/DoT profile).",
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
	weekdayMonday: "Monday",
	weekdayTuesday: "Tuesday",
	weekdayWednesday: "Wednesday",
	weekdayThursday: "Thursday",
	weekdayFriday: "Friday",
	weekdaySaturday: "Saturday",
	weekdaySunday: "Sunday",
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
	boardBackToList: "返回列表",
	boardChangeSummary: "将标记完成：{{done}}，取消完成：{{undone}}。",
	boardComment: "评论",
	boardDesc: "集中管理已同步笔记里的进行中 Bangumi 条目。",
	boardDiscardChanges: "放弃修改",
	boardEmpty: "同步目录里没有找到进行中的 Bangumi 笔记。",
	boardEmptyValue: "（空）",
	boardFilterEmpty: "当前类型筛选下没有进行中条目。",
	boardLoadFailed: "无法加载看板条目：{{message}}",
	boardLoading: "正在加载章节进度...",
	boardNoEpisodes: "没有可用的章节进度数据。",
	boardProgress: "{{done}}/{{total}}",
	boardPushChanges: "Push 修改",
	boardPushFinished:
		"Bangumi 看板写回完成：{{episodes}} 个章节变更。本地 Markdown checklist 已更新。",
	boardPushUnsupported: "看板章节写回只支持远端状态为 do 或 collect 的条目。",
	boardRating: "评分",
	boardRatingNone: "不评分",
	boardRefreshItem: "刷新条目",
	boardRefreshList: "刷新列表",
	boardStatus: "状态",
	boardStatusCommentDesc:
		"这条评论和评分会和状态变更一起保存到你的 Bangumi 收藏里。",
	boardStatusCommentTitle: "{{status}} 的收藏评论",
	boardStatusDesc: "修改状态会在你确认评论后写入 Bangumi。",
	boardStatusFinished: "Bangumi 状态已改为 {{status}}。",
	boardStatusStarted: "正在写入 Bangumi 状态...",
	boardTitle: "Bangumi 看板",
	boardTypeAll: "全部类型",
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
	collected: "看过",
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
	dailyNoteFolder: "日记文件夹",
	dailyNoteFolderDesc:
		"存放每日日记的文件夹。留空则沿用官方 Daily Notes 核心插件的设置。如果你用 QuickAdd、Periodic Notes 等方式创建日记，请在这里填写。",
	dailyNoteFormat: "日记日期格式",
	dailyNoteFormatDesc:
		"日记文件名使用的 moment.js 日期格式。留空则沿用官方 Daily Notes 核心插件的设置，兜底为 YYYY-MM-DD。",
	dailyNoteSyncBlock: "每日日记同步块",
	dailyNoteSyncBlockDesc: "复制这段同步块到你的每日日记模板里。",
	dailyNoteSyncMarkersMissing:
		"没有找到每日日记同步块标记。请先把同步块放进你的每日日记模板。",
	dailyNoteSyncNoteMissing:
		"没有找到今天的每日日记：{{path}}",
	dropped: "抛弃",
	droppedDesc: "同步标记为抛弃的条目。",
	enableWriteBack: "启用写回 Bangumi",
	enableWriteBackDesc:
		"允许从当前笔记显式 Push 到 Bangumi。这会修改你的 Bangumi 账号数据；每次 Push 前仍需确认。",
	error: "错误",
	fetchCollectionsStage: "拉取收藏",
	fetchEpisodesStage: "拉取章节进度",
	fetchedItems:
		"已拉取 {{count}} 个 {{subjectType}}/{{collectionStatus}} 条目。",
	fetchingCollections:
		"正在拉取 {{subjectType}}/{{collectionStatus}} 收藏...",
	fetchCharacters: "拉取角色信息",
	fetchCharactersDesc:
		"将条目角色信息暴露为模板变量。每个条目会增加一次 API 请求。",
	fileNameFormat: "文件命名格式",
	fetchDetailedSubjectInfo: "拉取详细条目信息",
	fetchDetailedSubjectInfoDesc:
		"将平台、卷数、总章节数、简介、infobox、公共标签、公共评分和收藏统计暴露为模板变量。",
	fetchRelations: "拉取关联条目",
	fetchRelationsDesc:
		"将关联条目暴露为模板变量。每个条目会增加一次 API 请求。",
	fetchStaff: "拉取制作人员 Staff",
	fetchStaffDesc:
		"将制作人员/人物信息暴露为模板变量。每个条目会增加一次 API 请求。",
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
	syncConcurrency: "同步并发数",
	syncConcurrencyDesc:
		"同步时同一时刻并发抓取多少个条目。越高越快，但更容易触发 Bangumi 限流。默认 4。",
	dnsFix: "DNS 修复（DoH）",
	dnsFixDesc:
		"选择 api.bgm.tv 的解析方式。自动：先走系统网络，只有出现网络错误后才改用 DNS-over-HTTPS，因此使用代理或 DNS 正常的用户完全不受影响。总是：直接走 DoH，适合已知系统 DNS 被污染、想省掉首次超时的情况。关闭：只使用 Obsidian 默认方式。仅桌面端生效，token 不会发给解析服务。",
	dnsFixAuto: "自动（推荐）",
	dnsFixAlways: "总是使用 DoH",
	dnsFixOff: "关闭",
	dnsFixMobileDesc:
		"移动端不支持：内置的 DNS-over-HTTPS 传输层需要桌面运行时。移动端若同步报网络错误，请在系统层开启加密 DNS —— Android 把「私人 DNS」设为 dns.alidns.com，iOS 安装 DoH/DoT 配置描述文件。",
	coversLocalized: "已为 {{count}} 条笔记本地化封面。",
	localizeCovers: "本地化封面图",
	localizeCoversDesc:
		"把封面下载到库中并改为本地链接，而不是引用远程地址。默认关闭，因为它会在库里额外存储文件；仅在远程封面加载不出来时建议开启，例如系统 DNS 无法解析 lain.bgm.tv。图片存放在同步目录下的 covers 文件夹。",
	statusDriftItem: "{{title}}（{{from}} → {{to}}）",
	statusDriftSeparator: "；",
	statusDriftUpdated:
		"已按 Bangumi 的现状更新 {{count}} 条笔记：{{items}}",
	statusDriftUpdatedMore:
		"已按 Bangumi 的现状更新 {{count}} 条笔记：{{items}} 等（另有 {{rest}} 条）",
	statusDriftUncollected:
		"{{count}} 条笔记已不在 Bangumi 收藏中：{{items}}",
	statusDriftOutOfScope:
		"另有 {{count}} 条本地笔记不在当前同步范围（条目类型未勾选）。",
	statusDriftFailed:
		"另有 {{count}} 条核对失败，详见控制台日志。",
	folderNaming: "分类文件夹命名",
	folderNamingDesc:
		"分类文件夹使用哪种语言命名。笔记 frontmatter 始终保留英文代码（type / status），所以切换命名不会改动已有笔记。切换后可用下方按钮把笔记迁移到新目录。",
	folderNamingEnglish: "英文（anime / do）",
	folderNamingChinese: "中文（BGM 用词）",
	migrateFolders: "迁移分类文件夹",
	migrateFoldersDesc:
		"把笔记从原来的目录命名迁移到当前命名。执行前会先显示预览，目标位置已存在同名笔记的会被跳过。",
	migrateFoldersButton: "预览并迁移",
	migrateFoldersTitle: "迁移分类文件夹",
	migrateFoldersIntro:
		"将把 {{moves}} 条笔记迁移到当前命名。{{conflicts}} 条因目标位置已存在同名文件被跳过。",
	migrateFoldersMore: "……另有 {{count}} 条",
	migrateFoldersConflictNote:
		"以下笔记在目标位置已存在，将保持原样不动：",
	migrateFoldersNothing: "没有需要迁移的文件夹。",
	migrateFoldersRunning: "正在迁移分类文件夹……",
	migrateFoldersDone:
		"迁移完成：移动 {{moved}} 条，跳过 {{conflicts}} 条。",
	migrateFoldersFailed: "文件夹迁移失败：{{message}}",
	migrateFoldersConfirm: "开始迁移",
	migrateFoldersCancel: "取消",
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
	enableOnAirNote: "启用每日放送笔记",
	enableOnAirNoteDesc:
		"同步后生成 Bangumi/On Air.md，按星期展示本周放送，并只保留你想看和进行中的动画收藏。",
	onAirNoteFailed: "每日放送笔记更新失败：{{message}}",
	onAirNoteUnchanged: "每日放送笔记没有变化：{{path}}",
	onAirNoteUpdated: "每日放送笔记已更新：{{path}}",
	openBoard: "打开 Bangumi 看板",
	openTokenPage: "打开 token 页面",
	progressStarted: "Bangumi Sync 已开始。",
	progressUnavailableReport: "没拉到进度内容",
	pushCancel: "取消",
	pushCancelled: "已取消 Bangumi 写回。",
	pushChecklistMissing:
		"没有找到可写回的章节 checklist。请先重新同步这条笔记，生成 bgm-ep 标记。",
	pushConfirm: "Push",
	pushConfirmDesc:
		"请确认下面的写回内容。继续后会修改你的 Bangumi 账号数据。",
	pushConfirmTitle: "确认写回 Bangumi",
	pushCurrentNote: "Push 当前笔记到 Bangumi",
	pushFailed: "Bangumi 写回失败：{{message}}",
	pushEpisodeVerifyFailed:
		"Bangumi 写回后没有确认这些章节变更：{{ids}}。请稍后再试一次。",
	pushFinished:
		"Bangumi 写回完成：{{episodes}} 个章节变更，最终状态：{{finalStatus}}。{{moved}}{{resync}}",
	pushFinishedResync:
		"Bangumi 在章节更新后自动改变了最终状态，建议重新同步这条笔记以刷新本地信息。",
	pushInvalidNote: "当前笔记不是有效的 Bangumi 条目笔记。",
	pushMoved: "已移动笔记到 {{path}}。",
	pushMoveTargetExists:
		"写回已经成功，但无法移动笔记，因为目标文件已存在：{{path}}",
	pushNoActiveFile: "请先打开一条 Bangumi 条目笔记。",
	pushNoChanges: "没有检测到需要写回 Bangumi 的变更。",
	pushStarted: "正在 Push 当前笔记到 Bangumi...",
	pushStatusUnsupported:
		"写回只支持 status 为 wish、do、collect、on_hold 或 dropped 的笔记。",
	pushStatusVerifyFailed:
		"Bangumi 没有确认状态变更。期望 {{expected}}，实际 {{actual}}。",
	pushUnknownEpisodes:
		"有些 bgm-ep 标记不属于当前条目。请先重新同步这条笔记再 Push：{{ids}}",
	pushWriteBackDisabled: "请先在插件设置中启用写回 Bangumi。",
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
	testTokenFailedMobileNetwork:
		"Token 测试失败：{{message}}。内置 DNS 修复仅在桌面端生效，若这是网络错误，请在系统设置里开启加密 DNS（Android：私人 DNS 设为 dns.alidns.com；iOS：安装 DoH/DoT 配置描述文件）。",
	testTokenSucceeded: "Token 有效，已连接为 {{username}}。",
	updateOnAirNote: "更新每日放送笔记",
	subjectType: "条目类型",
	subjectTypeRequired: "请选择至少一个要同步的 Bangumi 条目类型。",
	subjectTypes: "条目类型",
	templateDataSources: "模板数据开关",
	templateDataSourcesDesc:
		"模板里用到的变量会自动拉取。开启这些选项会强制额外拉取数据，增加 API 请求，同步可能变慢。",
	syncDirectory: "同步目录",
	syncDirectoryDesc: "笔记会创建在这个文件夹下。",
	syncFailed: "Bangumi Sync 失败：{{message}}",
	syncFailedMobileNetwork:
		"Bangumi Sync 失败：{{message}}。内置 DNS 修复仅在桌面端生效，若这是网络错误，请在系统设置里开启加密 DNS（Android：私人 DNS 设为 dns.alidns.com；iOS：安装 DoH/DoT 配置描述文件）。",
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
	watching: "在看",
	watchingDesc: "同步当前正在看/读/玩的条目。",
	weekdayMonday: "星期一",
	weekdayTuesday: "星期二",
	weekdayWednesday: "星期三",
	weekdayThursday: "星期四",
	weekdayFriday: "星期五",
	weekdaySaturday: "星期六",
	weekdaySunday: "星期日",
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
