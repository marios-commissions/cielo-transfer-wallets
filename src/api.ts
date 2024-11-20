import { setTimeout } from 'node:timers/promises';

import { BASE_URL } from './constants';


export async function getTrackedWallets(apiKey: string, page: number = 1) {
	const response = await fetch(BASE_URL + `tracked-wallets?next_object=${page}`, {
		method: 'GET',
		headers: {
			'X-Api-Key': apiKey
		}
	});

	if (response.status === 429) {
		const rateLimitReset = response.headers.get('X-Rate-Limit-Reset');
		const delay = Number(rateLimitReset) - Date.now();

		console.log(`Ratelimit hit while attempting to fetch all tracked wallets, waiting ${delay}ms.`);
		await setTimeout(delay);

		return getTrackedWallets(apiKey, page);
	}

	const json = await response.json();

	if (response.status === 200 && json.data) {
		return json.data;
	}

	return null;
}

const CACHE = Bun.file('./cache.json');
const cache = await (async () => {
	try {
		if (!await CACHE.exists()) {
			return { wallets: {}, lists: {} };
		}

		return await CACHE.json();
	} catch (error) {
		console.error('Failed to read cache, is it corrupted?', error);
		return {};
	}
})();

export async function fetchAllTrackedWallets(apiKey: string, useCache: boolean = true) {
	if (useCache && cache.wallets?.[apiKey] && !Bun.argv.some(f => f.includes('--cacheless'))) return cache.wallets?.[apiKey];

	const data: { pointer: number, results: string[]; } = { pointer: 1, results: [] };

	while (true) {
		try {
			const wallets = await getTrackedWallets(apiKey, data.pointer);

			if (!wallets || !wallets.tracked_wallets?.length) break;

			data.results = [...data.results, ...(wallets.tracked_wallets?.map((m: { wallet: any; }) => m.wallet) ?? [])];
			data.pointer = wallets.paging.next_object;
		} catch (error) {
			console.error(`Failed to fetch page ${data.pointer}, retrying in 1s.`);
			await setTimeout(1000);
		}
	}

	cache.wallets ??= {};
	cache.wallets[apiKey] = data.results;
	writeCache();

	return data.results;
}

export async function createList(apiKey: string, name: string, walletIds: string[] = []) {
	if (cache.lists?.[apiKey]) return cache.lists?.[apiKey];

	const response = await fetch(BASE_URL + 'lists', {
		method: 'POST',
		body: JSON.stringify({
			name,
			is_public: false,
			wallets: [],
			description: 'Cielo Wallet Transfer'
		}),
		headers: {
			'X-Api-Key': apiKey
		}
	});

	const json = await response.json();

	if (response.status !== 200) {
		throw new Error(`Received unexpected status code ${response.status}: ${JSON.stringify(json, null, 2)}`);
	}

	const id = json.data.id;

	cache.lists ??= {};
	cache.lists[apiKey] = id;
	writeCache();

	return id;
}

export async function addWallet(apiKey: string, wallet: string, listId: number) {
	const response = await fetch(BASE_URL + 'tracked-wallets', {
		method: 'POST',
		body: JSON.stringify({
			wallet,
			label: crypto.randomUUID(),
			list_id: listId
		}),
		headers: {
			'X-Api-Key': apiKey
		}
	});

	const json = await response.json();

	if (response.status !== 200) {
		throw new Error(`Received unexpected status code ${response.status}: ${JSON.stringify(json, null, 2)}`);
	}

	return json.data.id;
}

export async function writeCache() {
	await Bun.write(CACHE, JSON.stringify(cache, null, 2));
}