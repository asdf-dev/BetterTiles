import {copyFileSync, cpSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
mkdirSync('dist/schemas', {recursive: true});
for (const name of ['metadata.json', 'stylesheet.css', 'LICENSE']) copyFileSync(name, `dist/${name}`);
cpSync('schemas', 'dist/schemas', {recursive: true});
execFileSync('glib-compile-schemas', ['--strict', 'dist/schemas'], {stdio: 'inherit'});
