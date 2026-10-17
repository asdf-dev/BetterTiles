import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = resolve(root, 'dist');
const metadata = JSON.parse(readFileSync(resolve(dist, 'metadata.json'), 'utf8'));
const helpers = readdirSync(dist).filter(name => name.endsWith('.js') && name !== 'extension.js' && name !== 'prefs.js');
const args = ['pack', '--force', `--out-dir=${root}`, '--extra-source=LICENSE',
    ...helpers.map(name => `--extra-source=${name}`), '.'];
execFileSync('gnome-extensions', args, {cwd: dist, stdio: 'inherit'});
console.log(`Created ${resolve(root, `${metadata.uuid}.shell-extension.zip`)}`);
