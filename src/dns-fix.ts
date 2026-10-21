/**
 * How the plugin resolves api.bgm.tv.
 *
 * - `auto`   Use Obsidian's normal transport first and only switch to DoH
 *            after it fails with a network error. Nobody is affected unless
 *            their resolver is actually broken.
 * - `always` Resolve through DoH up front. Useful when the user knows the
 *            system resolver is poisoned and wants to skip the first timeout.
 * - `off`    Never use DoH. Respect system proxy / system CA settings only.
 *
 * Kept in its own module so both the settings schema and the API client can
 * import it without creating a cycle.
 */
export const DNS_FIX_MODES = {
	off: "off",
	auto: "auto",
	always: "always"
} as const;

export type DnsFixMode = (typeof DNS_FIX_MODES)[keyof typeof DNS_FIX_MODES];

export const DNS_FIX_MODE_VALUES: readonly string[] = [
	DNS_FIX_MODES.off,
	DNS_FIX_MODES.auto,
	DNS_FIX_MODES.always
];

export function isDnsFixMode(value: unknown): value is DnsFixMode {
	return typeof value === "string" && DNS_FIX_MODE_VALUES.includes(value);
}
