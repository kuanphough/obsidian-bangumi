/**
 * Whether an error looks like a network/connectivity failure rather than an API
 * or validation error.
 *
 * Used to decide whether to show the mobile DNS guidance: on mobile the plugin
 * cannot use its built-in DoH transport, so a network failure there is usually
 * a poisoned system resolver and the user needs to switch to encrypted DNS at
 * the OS level.
 */
const NETWORK_ERROR_PATTERNS = [
	"err_connection",
	"err_network",
	"err_internet_disconnected",
	"err_name_not_resolved",
	"err_address_unreachable",
	"err_timed_out",
	"econnrefused",
	"econnreset",
	"econnaborted",
	"etimedout",
	"enotfound",
	"eai_again",
	"ehostunreach",
	"networkerror",
	"failed to fetch",
	"network request failed",
	"request timed out",
	"connection was reset"
];

export function looksLikeNetworkError(error: unknown): boolean {
	let message = "";
	if (error instanceof Error) {
		message = error.message;
	} else if (typeof error === "string") {
		message = error;
	}
	if (message.length === 0) return false;

	const lower = message.toLowerCase();
	return NETWORK_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}
