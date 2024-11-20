import { addWallet, createList, fetchAllTrackedWallets } from './api';
import config from '../config.json';
import { from, to } from './argv';


if (!from || !to) {
	console.error('Please provide the API keys for the transfer in the following format: "bun run . <from> <to>"');
	process.exit(1);
}

console.log('Fetching destination existing wallets...');
const existingWallets = await fetchAllTrackedWallets(to, false);
console.log('Fetched destination existing wallets.');

console.log('Fetching origin wallets...');
const wallets = await fetchAllTrackedWallets(from);
console.log('Fetched origin wallets.');

const toAdd = wallets.filter((w: string) => !existingWallets.includes(w));

if (!toAdd.length) {
	console.log('No wallets to add to destination.');
	process.exit(0);
}

try {
	console.log('Creating list for wallets...');
	var listId = await createList(to, config.listName);
	console.log(`List created with id ${listId}.`);
} catch (error) {
	console.error('Failed to create list:', error);
}

console.log(`-> Adding ${toAdd.length} wallets to destination. <-`);

for (const wallet of toAdd) {
	try {
		console.debug(`Adding ${wallet}...`);

		await addWallet(to, wallet, listId);

		console.log(`Added ${wallet}.`);
	} catch (error) {
		console.error(`Failed to add wallet ${wallet} to destination:`, error);
	}
}