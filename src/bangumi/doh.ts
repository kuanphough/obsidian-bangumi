import type { RequestUrlResponse } from "obsidian";

/**
 * DNS-over-HTTPS transport for Bangumi API requests.
 *
 * Some networks return poisoned addresses for the bgm.tv domains, so
 * Obsidian's requestUrl() times out even though the site itself is fine.
 * This transport resolves the hostname over DoH and then opens the TLS
 * connection straight to the resolved address, while keeping the original
 * hostname for SNI and certificate validation.
 *
 * Design notes:
 * - Only the hostname is ever sent to the DoH resolver. The access token and
 *   every other header stay on the request to api.bgm.tv.
 * - Endpoints are ordered domestic-first, because DoH is encrypted and a
 *   domestic resolver therefore cannot poison the answer, while 1.1.1.1 is
 *   frequently rate limited from mainland China.
 * - The whole resolution has a hard time budget so a blocked network cannot
 *   stall a sync for minutes.
 *
 * Desktop only: relies on Node's https module. Callers must check
 * isDohTransportAvailable() first.
 */

type DohAnswer = { type?: number; data?: string };

const DOH_ENDPOINTS = [
	"https://223.5.5.5/resolve",
	"https://1.12.12.12/dns-query",
	"https://1.1.1.1/dns-query",
	"https://8.8.8.8/resolve"
];

const A_RECORD = 1;
const AAAA_RECORD = 28;

const CACHE_TTL_MS = 10 * 60 * 1000;
const QUERY_TIMEOUT_MS = 3_000;
/** Upper bound for resolving one hostname across all endpoints and records. */
const RESOLVE_BUDGET_MS = 6_000;
const FAILURE_COOLDOWN_MS = 60 * 1000;

interface CacheEntry {
	address: string;
	family: number;
	expiresAt: number;
}

const addressCache = new Map<string, CacheEntry>();
let unavailableUntil = 0;

export interface DohRequestInit {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
	timeoutMs: number;
}

export function isDohTransportAvailable(): boolean {
	const versions = (
		globalThis as { process?: { versions?: Record<string, string> } }
	).process?.versions;
	return typeof versions?.node === "string";
}

function nodeRequire<T>(id: string): T {
	const globalScope = globalThis as { require?: (id: string) => unknown };
	if (typeof globalScope.require === "function") {
		return globalScope.require(id) as T;
	}
	// Fall back to the CommonJS `require` of the plugin bundle. Guarded by
	// `typeof` so this is safe on mobile, where it is undefined.
	if (typeof require === "function") {
		return (require as (id: string) => unknown)(id) as T;
	}
	throw new Error(`Node module "${id}" is unavailable`);
}

/** Drop a cached address so the next lookup re-resolves it. */
export function invalidateDohCache(hostname: string): void {
	addressCache.delete(hostname);
}

function queryDoh(
	endpoint: string,
	hostname: string,
	recordType: number
): Promise<DohAnswer[]> {
	const https = nodeRequire<typeof import("https")>("https");
	const recordName = recordType === AAAA_RECORD ? "AAAA" : "A";
	const url = `${endpoint}?name=${encodeURIComponent(hostname)}&type=${recordName}`;

	return new Promise<DohAnswer[]>((resolve, reject) => {
		const request = https.get(
			url,
			{
				headers: { accept: "application/dns-json" },
				timeout: QUERY_TIMEOUT_MS
			},
			(response) => {
				let body = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					body += chunk;
				});
				response.on("end", () => {
					try {
						const parsed = JSON.parse(body) as { Answer?: DohAnswer[] };
						resolve(Array.isArray(parsed.Answer) ? parsed.Answer : []);
					} catch (error) {
						reject(error);
					}
				});
				response.on("error", reject);
			}
		);
		request.on("timeout", () =>
			request.destroy(new Error("DoH query timed out"))
		);
		request.on("error", reject);
	});
}

/**
 * Resolve a hostname through DoH, preferring IPv4. Returns null when every
 * endpoint fails or the budget runs out (the caller then falls back).
 */
export async function resolveViaDoh(
	hostname: string
): Promise<{ address: string; family: number } | null> {
	const now = Date.now();
	const cached = addressCache.get(hostname);
	if (cached && cached.expiresAt > now) {
		return { address: cached.address, family: cached.family };
	}
	if (now < unavailableUntil) {
		return null;
	}

	const deadline = now + RESOLVE_BUDGET_MS;

	// Try A records on every endpoint before falling back to AAAA, so a slow
	// IPv6-only answer cannot eat the whole budget.
	for (const recordType of [A_RECORD, AAAA_RECORD]) {
		for (const endpoint of DOH_ENDPOINTS) {
			if (Date.now() >= deadline) break;
			try {
				const answers = await queryDoh(endpoint, hostname, recordType);
				const match = answers.find(
					(answer) =>
						answer.type === recordType && typeof answer.data === "string"
				);
				if (!match?.data) continue;
				const family = recordType === AAAA_RECORD ? 6 : 4;
				addressCache.set(hostname, {
					address: match.data,
					family,
					expiresAt: Date.now() + CACHE_TTL_MS
				});
				return { address: match.data, family };
			} catch {
				// Try the next endpoint.
			}
		}
		if (Date.now() >= deadline) break;
	}

	unavailableUntil = Date.now() + FAILURE_COOLDOWN_MS;
	return null;
}

function collectHeaders(
	raw: Record<string, string | string[] | undefined>
): Record<string, string> {
	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(raw)) {
		if (value === undefined) continue;
		headers[key] = Array.isArray(value) ? value.join(", ") : value;
	}
	return headers;
}

/**
 * Perform an HTTPS request that resolves the host through DoH. The returned
 * object mirrors the shape of Obsidian's RequestUrlResponse so it can be used
 * interchangeably by the client.
 */
export async function dohRequest(
	init: DohRequestInit
): Promise<RequestUrlResponse> {
	const https = nodeRequire<typeof import("https")>("https");
	const parsed = new URL(init.url);
	const resolved = await resolveViaDoh(parsed.hostname);
	if (!resolved) {
		throw new Error(`DoH resolution failed for ${parsed.hostname}`);
	}

	return new Promise<RequestUrlResponse>((resolve, reject) => {
		const fail = (error: unknown): void => {
			// The cached address may be stale (Cloudflare rotates IPs); drop it
			// so the next attempt resolves again instead of failing for 10 min.
			invalidateDohCache(parsed.hostname);
			reject(error);
		};

		const request = https.request(
			{
				protocol: parsed.protocol,
				hostname: parsed.hostname,
				port: parsed.port || 443,
				path: `${parsed.pathname}${parsed.search}`,
				method: init.method ?? "GET",
				headers: init.headers,
				timeout: init.timeoutMs,
				// Connect to the DoH answer while keeping hostname for SNI / certs.
				lookup: ((
					_hostname: string,
					options: { all?: boolean } | undefined,
					callback: (
						error: Error | null,
						address: string | Array<{ address: string; family: number }>,
						family?: number
					) => void
				) => {
					// Node 18+ calls lookup with all:true and expects an array back.
					if (options?.all) {
						callback(null, [
							{ address: resolved.address, family: resolved.family }
						]);
						return;
					}
					callback(null, resolved.address, resolved.family);
				}) as unknown as import("net").LookupFunction
			},
			(response) => {
				const chunks: Buffer[] = [];
				response.on("data", (chunk: Buffer) => {
					chunks.push(chunk);
				});
				response.on("error", fail);
				response.on("end", () => {
					const buffer = Buffer.concat(chunks);
					const text = buffer.toString("utf8");
					let json: unknown;
					try {
						json = text.length > 0 ? JSON.parse(text) : undefined;
					} catch {
						json = undefined;
					}
					resolve({
						status: response.statusCode ?? 0,
						headers: collectHeaders(response.headers),
						text,
						json,
						arrayBuffer: buffer.buffer.slice(
							buffer.byteOffset,
							buffer.byteOffset + buffer.byteLength
						) as ArrayBuffer
					} as RequestUrlResponse);
				});
			}
		);

		request.on("timeout", () =>
			request.destroy(new Error("Bangumi request timed out"))
		);
		request.on("error", fail);
		if (init.body !== undefined) {
			request.write(init.body);
		}
		request.end();
	});
}
