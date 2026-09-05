import { execFileSync } from 'node:child_process';
import { readdir, readFile, access } from 'node:fs/promises';
import { assets } from '../server.mjs';
const files = ['server.mjs'];
for (const dir of ['lib','public','site','scripts','tests']) {
  for (const file of await readdir(dir)) if (/\.(mjs|js)$/.test(file)) files.push(`${dir}/${file}`);
}
for (const file of files) execFileSync(process.execPath,['--check',file],{ stdio:'pipe' });

// Every served route must exist on disk, and every local reference in public/ must be a served route.
const routes = new Map([...assets].map(([route,[name]]) => [route,name]));
for (const [route,name] of routes) await access(`public/${name}`).catch(() => { throw new Error(`Asset route ${route} points at a missing file public/${name}.`); });
let references = 0;
const sources = (await readdir('public')).filter(file => /\.(html|js|css)$/.test(file));
for (const file of sources) {
  const text = await readFile(`public/${file}`,'utf8');
  const found = [...text.matchAll(/(?:src|href)="(\/[^"?#]*)"|from\s+'\.\/([^']+)'|import\('\/([^']+)'\)|url\(\/([^)]+)\)/g)].map(m => m[1] || `/${m[2] || m[3] || m[4]}`);
  for (const path of found) {
    references++;
    if (!routes.has(path)) throw new Error(`public/${file} references ${path}, which server.mjs does not serve.`);
  }
}

// Type floor: nothing under 12px in the app, per PRODUCT.md.
let declarations = 0, stylesheets = 0;
for (const file of sources.filter(f => f.endsWith('.css'))) {
  stylesheets++;
  const text = await readFile(`public/${file}`,'utf8');
  const small = [...text.matchAll(/font(?:-size)?\s*:[^;{}]*?\b([1-9]|1[01])px/g)];
  declarations += small.length;
  if (small.length) throw new Error(`public/${file} has ${small.length} font declaration(s) under 12px, first: "${small[0][0]}".`);
}

// The clipboard is write-only. A read would make "screen & mic off" untrue, so none may exist in the page or the shell.
let clipboardReads = 0, clipboardFiles = 0;
const shipped = ['server.mjs', ...sources.map(f => `public/${f}`), ...(await readdir('lib')).map(f => `lib/${f}`), ...(await readdir('desktop')).filter(f => /\.cs$/.test(f)).map(f => `desktop/${f}`), ...(await readdir('scripts')).filter(f => /\.(cs|ps1|cmd)$/.test(f)).map(f => `scripts/${f}`)];
for (const file of shipped) {
  clipboardFiles++;
  const text = await readFile(file,'utf8');
  clipboardReads += (text.match(/clipboard\.readText\(|clipboard\.read\(|Clipboard\.(GetText|GetData|GetDataObject|Contains\w*|GetImage|GetFileDropList)\(|GetClipboardData|Get-Clipboard|OpenClipboard/g) || []).length;
}
if (clipboardReads) throw new Error(`${clipboardReads} clipboard read site(s) found; the clipboard is write-only.`);

const html = await readFile('public/index.html','utf8');
if (!html.includes('name="robots" content="noindex,nofollow"')) throw new Error('Missing local-app noindex.');
console.log(`PASS: syntax checked ${files.length} JavaScript files; assets: ${routes.size} routes on disk, ${references} references resolved; scanned ${stylesheets} stylesheets, ${declarations} declarations under 12px; ${clipboardFiles} files scanned, ${clipboardReads} clipboard reads; local page is noindex.`);
