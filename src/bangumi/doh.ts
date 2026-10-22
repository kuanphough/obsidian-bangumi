import { Platform } from "obsidian";
import type { RequestUrlResponse } from "obsidian";

/**
 * DNS-over-HTTPS transport for Bangumi requests.
 *
 * Some networks return poisoned addresses for the bgm.tv domains, so
 * Obsidian's requestUrl() times out even though the site itself is fine.
 * This transport resolves the hostname over DoH and then opens the TLS
 * connection straight to a resolved address, while keeping the original
 * hostname for SNI and certificate validation.
 *
 * A single resolver cannot be trusted: a domestic DoH endpoint has been
 * observed answering api.bgm.tv with a dead, non-Cloudflare address while the
 * others agree. So every lookup asks several endpoints in parallel, ranks the
 * answers by how many endpoints agree, and the request then tries the ranked
 * candidates one by one until one actually connects. That way a resolver that
 * lies just loses the vote instead of breaking the sync.
 *
 * Only the hostname is ever sent to a resolver. The access token and every
 * other header stay on the request to the real host.
 *
 * Desktop only: relies on Node's https module. Callers must check
 * isDohTransportAvailable() first.
 */

/** Queried in parallel; order only affects the tie-break in rankDohAnswers(). */
const DOH_ENDPOINTS = [
	"https://1.12.12.12/dns-query",
	"https://1.1.1.1/dns-query",
	"https://8.8.8.8/resolve",
	"https://223.5.5.5/resolve"
];

const A_RECORD = 1;
const AAAA_RECORD = 28;

const CACHE_TTL_MS = 10 * 60 * 1000;
const QUERY_TIMEOUT_MS = 3_000;
/** Timeout for retry attempts after the highest-voted candidate failed. */
const RETRY_ATTEMPT_TIMEOUT_MS = 5_000;
const FAILURE_COOLDOWN_MS = 60 * 1000;
const BAD_ADDRESS_TTL_MS = 10 * 60 * 1000;

interface CachedAddresses {
	addresses: string[];
	family: number;
	expiresAt: number;
}

const addressCache = new Map<string, CachedAddresses>();
/** Addresses that already failed to connect, so they are tried last. */
const badAddresses = new Map<string, number>();
let unavailableUntil = 0;

export interface DohRequestInit {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
	timeoutMs: number;
}

export interface DohDownloadInit {
	url: string;
	headers?: Record<string, string>;
	timeoutMs: number;
}

export function isDohTransportAvailable(): boolean {
	return Platform.isDesktopApp;
}

/** Minimal view of the Electron renderer window needed to reach Node's require. */
interface NodeCapableWindow extends Window {
	require?: (id: string) => unknown;
}

/**
 * Declared locally so this module does not depend on `@types/node` being
 * resolvable. Shadowing the Node global here is intentional: it keeps the
 * fallback path typed even in type-checking environments without Node types.
 */
declare const require: ((id: string) => unknown) | undefined;

/**
 * Minimal structural types for the Node HTTPS entry points we use.
 *
 * Declared locally instead of `typeof import("https")`: when a type checker
 * cannot resolve `@types/node`, that import silently degrades to `any` and
 * everything downstream (request, response, headers) becomes unsafe. Local
 * structural types keep this file typed no matter how the host resolves Node.
 */
interface NodeResponse {
	setEncoding(encoding: string): void;
	on(event: "data", listener: (chunk: string) => void): void;
	on(event: "end", listener: () => void): void;
	on(event: "error", listener: (error: Error) => void): void;
	headers: Record<string, string | string[] | undefined>;
	statusCode?: number;
}

/** Same socket, binary chunks. Without setEncoding Node hands us Buffers. */
interface NodeBinaryResponse {
	on(event: "data", listener: (chunk: Uint8Array) => void): void;
	on(event: "end", listener: () => void): void;
	on(event: "error", listener: (error: Error) => void): void;
	statusCode?: number;
}

interface NodeRequest {
	on(event: "timeout", listener: () => void): void;
	on(event: "error", listener: (error: Error) => void): void;
	destroy(error?: Error): void;
	write(chunk: string): void;
	end(): void;
}

type LookupCallback = (
	error: Error | null,
	address: string | Array<{ address: string; family: number }>,
	family?: number
) => void;

type ConnectionOptions = {
	protocol: string;
	hostname: string;
	port: number | string;
	path: string;
	method: string;
	headers?: Record<string, string>;
	timeout: number;
	lookup: (
		hostname: string,
		options: { all?: boolean },
		callback: LookupCallback
	) => void;
};

interface NodeHttps {
	get(
		url: string,
		options: { headers?: Record<string, string>; timeout?: number },
		callback: (response: NodeResponse) => void
	): NodeRequest;
	request(
		options: ConnectionOptions,
		callback: (response: NodeResponse) => void
	): NodeRequest;
}

/**
 * Load Node's `https` through the renderer's `require`. Lazy on purpose: the
 * module is only touched when the DoH transport is actually used, so mobile
 * never reaches it.
 */
function loadHttps(): NodeHttps {
	const fromWindow = (window as NodeCapableWindow).require;
	const loader: ((id: string) => unknown) | undefined =
		typeof fromWindow === "function"
			? fromWindow
			: typeof require === "function"
				? require
				: undefined;
	if (!loader) {
		throw new Error('Node module "https" is unavailable in this environment');
	}
	return loader("https") as NodeHttps;
}

/** Drop cached data for a hostname so the next lookup re-resolves it. */
export function invalidateDohCache(hostname: string): void {
	addressCache.delete(hostname);
}

function isBadAddress(address: string): boolean {
	const until = badAddresses.get(address);
	if (until === undefined) return false;
	if (until <= Date.now()) {
		badAddresses.delete(address);
		return false;
	}
	return true;
}

function markBadAddress(address: string): void {
	badAddresses.set(address, Date.now() + BAD_ADDRESS_TTL_MS);
}

function toError(value: unknown, fallback: string): Error {
	if (value instanceof Error) return value;
	if (typeof value === "string" && value.length > 0) return new Error(value);
	return new Error(fallback);
}

/** Pull the A/AAAA records of one record type out of a DoH JSON answer. */
function extractAddresses(payload: unknown, recordType: number): string[] {
	if (typeof payload !== "object" || payload === null) return [];
	const answers = (payload as { Answer?: unknown }).Answer;
	if (!Array.isArray(answers)) return [];

	const addresses: string[] = [];
	for (const answer of answers) {
		if (typeof answer !== "object" || answer === null) continue;
		const record = answer as { type?: unknown; data?: unknown };
		if (record.type === recordType && typeof record.data === "string") {
			addresses.push(record.data);
		}
	}
	return addresses;
}

function queryDoh(
	endpoint: string,
	hostname: string,
	recordType: number
): Promise<string[]> {
	const https = loadHttps();
	const recordName = recordType === AAAA_RECORD ? "AAAA" : "A";
	const url = `${endpoint}?name=${encodeURIComponent(hostname)}&type=${recordName}`;

	return new Promise<string[]>((resolve, reject) => {
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
						resolve(extractAddresses(JSON.parse(body), recordType));
					} catch (error) {
						reject(toError(error, "DoH response was not valid JSON"));
					}
				});
				response.on("error", (error: Error) => reject(error));
			}
		);
		request.on("timeout", () =>
			request.destroy(new Error("DoH query timed out"))
		);
		request.on("error", (error: Error) => reject(error));
	});
}

/**
 * Rank DoH answers by how many endpoints agree, then by the position the
 * endpoint reported them in.
 *
 * A resolver cannot be trusted on its own: 223.5.5.5 has been observed
 * answering api.bgm.tv with a dead, non-Cloudflare address while three other
 * endpoints agreed on the real Cloudflare set. Voting means such an answer is
 * ranked last instead of being used just because it replied first.
 */
export function rankDohAnswers(answerSets: string[][]): string[] {
	const votes = new Map<string, number>();
	const order = new Map<string, number>();

	for (const list of answerSets) {
		if (list.length === 0) continue;
		for (const address of new Set(list)) {
			votes.set(address, (votes.get(address) ?? 0) + 1);
		}
		for (const [index, address] of list.entries()) {
			if (!order.has(address)) order.set(address, index);
		}
	}

	return [...votes.entries()]
		.sort((a, b) => {
			if (b[1] !== a[1]) return b[1] - a[1];
			return (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99);
		})
		.map(([address]) => address);
}

/**
 * Ask every endpoint in parallel and rank the answers by agreement.
 * Returns null when nothing usable came back.
 */
async function collectAddresses(
	hostname: string,
	recordType: number
): Promise<string[] | null> {
	const results = await Promise.all(
		DOH_ENDPOINTS.map((endpoint) =>
			queryDoh(endpoint, hostname, recordType).catch((): string[] => [])
		)
	);

	if (results.every((list) => list.length === 0)) {
		return null;
	}

	const ranked = rankDohAnswers(results);
	return ranked.length > 0 ? ranked : null;
}

/**
 * Resolve a hostname through DoH. Prefers IPv4 and only falls back to IPv6
 * when no A record came back. Returns the ranked candidates, or null when
 * every endpoint failed.
 */
export async function resolveViaDoh(
	hostname: string
): Promise<{ addresses: string[]; family: number } | null> {
	const now = Date.now();
	const cached = addressCache.get(hostname);
	if (cached && cached.expiresAt > now) {
		return { addresses: cached.addresses, family: cached.family };
	}
	if (now < unavailableUntil) {
		return null;
	}

	for (const [recordType, family] of [
		[A_RECORD, 4],
		[AAAA_RECORD, 6]
	] as const) {
		const addresses = await collectAddresses(hostname, recordType);
		if (!addresses || addresses.length === 0) continue;
		addressCache.set(hostname, {
			addresses,
			family,
			expiresAt: Date.now() + CACHE_TTL_MS
		});
		return { addresses, family };
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
 * Run `attempt` against every ranked candidate until one connects.
 *
 * A candidate that fails is quarantined so later requests skip it, and the whole
 * answer set is invalidated when nothing worked (the resolver probably lied).
 */
async function withCandidates<T>(
	url: URL,
	timeoutMs: number,
	attempt: (address: string, family: number, timeoutMs: number) => Promise<T>
): Promise<T> {
	const resolved = await resolveViaDoh(url.hostname);
	if (!resolved) {
		throw new Error(`DoH resolution failed for ${url.hostname}`);
	}

	const usable = resolved.addresses.filter((address) => !isBadAddress(address));
	const ordered = [
		...usable,
		...resolved.addresses.filter((address) => isBadAddress(address))
	];
	if (ordered.length === 0) {
		invalidateDohCache(url.hostname);
		throw new Error(`DoH returned no usable address for ${url.hostname}`);
	}

	let lastError: Error | null = null;
	for (const [index, address] of ordered.entries()) {
		// The top candidate gets the caller's full timeout; retries stay short so
		// a quarantined address cannot stall the request for long.
		const attemptTimeout =
			index === 0 ? timeoutMs : Math.min(timeoutMs, RETRY_ATTEMPT_TIMEOUT_MS);
		try {
			return await attempt(address, resolved.family, attemptTimeout);
		} catch (error) {
			lastError = toError(error, `DoH request failed for ${address}`);
			markBadAddress(address);
		}
	}

	invalidateDohCache(url.hostname);
	throw lastError ?? new Error(`DoH request failed for ${url.hostname}`);
}

function connectionOptions(
	url: URL,
	address: string,
	family: number,
	timeoutMs: number,
	headers?: Record<string, string>
): ConnectionOptions {
	return {
		protocol: url.protocol,
		hostname: url.hostname,
		port: url.port || 443,
		path: `${url.pathname}${url.search}`,
		method: "GET",
		headers,
		timeout: timeoutMs,
		// Connect to the DoH answer while keeping hostname for SNI / certs.
		lookup: (
			_hostname: string,
			options: { all?: boolean },
			callback: LookupCallback
		): void => {
			// Node 18+ calls lookup with all:true and expects an array back.
			if (options.all) {
				callback(null, [{ address, family }], family);
				return;
			}
			callback(null, address, family);
		}
	};
}

function attemptRequest(
	url: URL,
	init: DohRequestInit,
	address: string,
	family: number,
	timeoutMs: number
): Promise<RequestUrlResponse> {
	const https = loadHttps();
	const options = connectionOptions(
		url,
		address,
		family,
		timeoutMs,
		init.headers
	);
	options.method = init.method ?? "GET";

	return new Promise<RequestUrlResponse>((resolve, reject) => {
		const request = https.request(options, (response) => {
			// Any HTTP response means this address works, whatever the status.
			const chunks: string[] = [];
			response.setEncoding("utf8");
			response.on("data", (chunk: string) => {
				chunks.push(chunk);
			});
			response.on("error", (error: Error) => reject(error));
			response.on("end", () => {
				const text = chunks.join("");
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
					// JSON endpoints only. Binary downloads go through dohDownload().
					arrayBuffer: new ArrayBuffer(0)
				});
			});
		});

		request.on("timeout", () =>
			request.destroy(new Error("Bangumi request timed out"))
		);
		request.on("error", (error: Error) => reject(error));
		if (init.body !== undefined) {
			request.write(init.body);
		}
		request.end();
	});
}

function attemptDownload(
	url: URL,
	init: DohDownloadInit,
	address: string,
	family: number,
	timeoutMs: number
): Promise<ArrayBuffer> {
	const https = loadHttps();
	const options = connectionOptions(
		url,
		address,
		family,
		timeoutMs,
		init.headers
	);

	return new Promise<ArrayBuffer>((resolve, reject) => {
		const request = https.request(options, (response) => {
			// No setEncoding: Node hands over Buffers, which are Uint8Arrays.
			const binary = response as unknown as NodeBinaryResponse;
			const chunks: Uint8Array[] = [];
			binary.on("data", (chunk: Uint8Array) => {
				chunks.push(chunk);
			});
			binary.on("error", (error: Error) => reject(error));
			binary.on("end", () => {
				const status = binary.statusCode ?? 0;
				if (status < 200 || status >= 300) {
					reject(new Error(`Download failed with HTTP ${status}`));
					return;
				}
				let total = 0;
				for (const chunk of chunks) total += chunk.length;
				const merged = new Uint8Array(total);
				let offset = 0;
				for (const chunk of chunks) {
					merged.set(chunk, offset);
					offset += chunk.length;
				}
				resolve(merged.buffer);
			});
		});

		request.on("timeout", () =>
			request.destroy(new Error("Bangumi download timed out"))
		);
		request.on("error", (error: Error) => reject(error));
		request.end();
	});
}

/**
 * Perform an HTTPS request that resolves the host through DoH. The returned
 * object mirrors the shape of Obsidian's RequestUrlResponse so it can be used
 * interchangeably by the client.
 */
export async function dohRequest(
	init: DohRequestInit
): Promise<RequestUrlResponse> {
	const url = new URL(init.url);
	return withCandidates(url, init.timeoutMs, (address, family, timeoutMs) =>
		attemptRequest(url, init, address, family, timeoutMs)
	);
}

/** Download binary content (cover images) through the DoH transport. */
export async function dohDownload(init: DohDownloadInit): Promise<ArrayBuffer> {
	const url = new URL(init.url);
	return withCandidates(url, init.timeoutMs, (address, family, timeoutMs) =>
		attemptDownload(url, init, address, family, timeoutMs)
	);
}
