export async function mapWithConcurrency<T, R>(
	items: readonly T[],
	concurrency: number,
	worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const limit = Math.max(1, Math.floor(concurrency));
	const results: R[] = new Array(items.length);
	let nextIndex = 0;

	async function runWorker(): Promise<void> {
		for (;;) {
			const current = nextIndex;
			if (current >= items.length) return;
			nextIndex++;
			results[current] = await worker(items[current], current);
		}
	}

	const workers: Promise<void>[] = [];
	const workerCount = Math.min(limit, items.length);
	for (let i = 0; i < workerCount; i++) {
		workers.push(runWorker());
	}
	await Promise.all(workers);
	return results;
}
