import {cpSync, mkdirSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
const {uuid} = JSON.parse(readFileSync('metadata.json', 'utf8'));
const target = join(process.env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'gnome-shell/extensions', uuid);
mkdirSync(target, {recursive: true});
cpSync('dist', target, {recursive: true});
console.log(`Installed to ${target}\nLog out and back in if GNOME has not discovered it yet, then enable Better Tiles in Extensions.`);
