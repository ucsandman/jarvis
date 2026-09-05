import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
const files = ['server.mjs'];
for (const dir of ['lib','public','scripts','tests']) {
  for (const file of await readdir(dir)) if (/\.(mjs|js)$/.test(file)) files.push(`${dir}/${file}`);
}
for (const file of files) execFileSync(process.execPath,['--check',file],{ stdio:'pipe' });
const html = await readFile('public/index.html','utf8');
for (const asset of ['app.js','style.css','mark.svg','reference.svg']) await readFile(`public/${asset}`);
if (!html.includes('name="robots" content="noindex,nofollow"')) throw new Error('Missing local-app noindex.');
console.log(`PASS: syntax checked ${files.length} JavaScript files; 4 assets present; local page is noindex. No compilation required.`);
