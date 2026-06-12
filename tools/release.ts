/* eslint-disable no-console */
import { exit } from 'process';
import { Release } from 'zotero-plugin-scaffold';
import loadConfig from './config';

main().catch(error => {
    console.error(error);
    exit(1);
});

async function main() {
    const config = await loadConfig(false, true);
    const releaser = new Release(config);
    await releaser.run();
}
